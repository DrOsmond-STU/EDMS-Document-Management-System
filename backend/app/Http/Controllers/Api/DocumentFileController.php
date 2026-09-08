<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\DocumentFile;
use App\Services\AuditLogger;
use App\Services\WatermarkService;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentFileController extends Controller
{
    /** Jenis berkas yang boleh diunggah — daftar putih, bukan daftar hitam. */
    private const ALLOWED_MIMES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/png',
        'image/jpeg',
    ];

    private const MAX_KB = 25600; // 25 MB

    public function __construct(private AuditLogger $audit, private WatermarkService $watermark) {}

    public function store(Request $request, Document $document): JsonResponse
    {
        $this->authorize('uploadFile', $document);

        $request->validate([
            'file' => [
                'required', 'file', 'max:'.self::MAX_KB,
                'mimetypes:'.implode(',', self::ALLOWED_MIMES),
            ],
            'is_primary' => ['boolean'],
        ], [
            'file.mimetypes' => 'Jenis berkas tidak didukung. Gunakan PDF, Word, Excel, PowerPoint, atau gambar.',
            'file.max' => 'Ukuran berkas melebihi 25 MB.',
        ]);

        $upload = $request->file('file');
        $user = $request->user();

        // Nama berkas dari pengguna TIDAK dipakai sebagai path penyimpanan —
        // hanya disimpan sebagai label. Path dibuat acak agar tidak bisa
        // ditebak dan tidak bisa dipakai untuk path traversal.
        $storedPath = sprintf(
            'documents/%s/%s/%s.%s',
            now()->format('Y'),
            $document->id,
            Str::ulid(),
            strtolower($upload->getClientOriginalExtension() ?: 'bin'),
        );

        $checksum = hash_file('sha256', $upload->getRealPath());

        Storage::disk('documents')->put($storedPath, file_get_contents($upload->getRealPath()));

        $file = DB::transaction(function () use ($request, $document, $upload, $storedPath, $checksum, $user) {
            $makePrimary = $request->boolean('is_primary', true);

            if ($makePrimary) {
                DocumentFile::where('document_id', $document->id)->update(['is_primary' => false]);
            }

            $file = DocumentFile::create([
                'document_id' => $document->id,
                // Berkas menempel pada revisi berjalan, sehingga versi lama
                // tetap bisa diunduh sebagai bukti.
                'document_revision_id' => $document->revisions()->first()?->id,
                'original_name' => $upload->getClientOriginalName(),
                'disk' => 'documents',
                'stored_path' => $storedPath,
                'mime_type' => $upload->getMimeType(),
                'size_bytes' => $upload->getSize(),
                'checksum_sha256' => $checksum,
                'is_primary' => $makePrimary,
                'uploaded_by' => $user->id,
                'uploaded_by_name' => $user->name,
            ]);

            $this->audit->log($user, 'upload', 'DocumentFile', (string) $file->id, $document->code,
                "Mengunggah berkas \"{$file->original_name}\" ke {$document->code}");

            return $file;
        });

        return response()->json($file->fresh(), 201);
    }

    /**
     * Unduh berkas ASLI (tanpa watermark). Untuk dokumen terkontrol
     * (pernah released — lihat Document::isControlled), ini SENGAJA
     * dibatasi hanya untuk Document Controller: siapa pun yang lain harus
     * lewat view() yang menempelkan watermark "uncontrolled copy" —
     * "tidak boleh download langsung" sesuai permintaan.
     */
    public function download(Request $request, Document $document, DocumentFile $file): StreamedResponse|JsonResponse
    {
        $this->authorize('downloadFile', $document);

        if ($file->document_id !== $document->id) {
            return response()->json(['message' => 'Berkas tidak ditemukan pada dokumen ini.'], 404);
        }

        if ($document->isControlled() && ! $request->user()->hasPermission(Permissions::DOCUMENT_CONTROL)) {
            return response()->json([
                'message' => 'Berkas asli dokumen terkontrol hanya bisa diunduh Document Controller. Gunakan "Lihat Dokumen" untuk salinan berwatermark.',
            ], 403);
        }

        if (! $file->exists()) {
            return response()->json(['message' => 'Berkas tidak ditemukan di penyimpanan.'], 404);
        }

        $this->audit->log($request->user(), 'download', 'DocumentFile', (string) $file->id, $document->code,
            "Mengunduh berkas \"{$file->original_name}\" dari {$document->code}");

        return Storage::disk($file->disk)->download(
            $file->stored_path,
            $file->original_name,
            ['Content-Type' => $file->mime_type],
        );
    }

    /**
     * Pratinjau untuk dilihat di layar (dan dicetak/print-to-PDF). Untuk
     * dokumen terkontrol, berkas ditempeli watermark "UNCONTROLLED COPY"
     * SUNGGUHAN ke dalam berkasnya (bukan lapisan CSS) sebelum dikirim,
     * disposisi "inline" (bukan attachment) supaya terbuka di penampil
     * bawaan browser, bukan langsung terunduh.
     */
    public function view(Request $request, Document $document, DocumentFile $file): Response|JsonResponse
    {
        $this->authorize('downloadFile', $document);

        if ($file->document_id !== $document->id) {
            return response()->json(['message' => 'Berkas tidak ditemukan pada dokumen ini.'], 404);
        }
        if (! $file->exists()) {
            return response()->json(['message' => 'Berkas tidak ditemukan di penyimpanan.'], 404);
        }

        $absolutePath = Storage::disk($file->disk)->path($file->stored_path);

        if (! $document->isControlled()) {
            // Belum pernah dirilis — dokumen kerja, bukan salinan terkontrol.
            // Tampilkan apa adanya, tanpa watermark.
            return response(Storage::disk($file->disk)->get($file->stored_path))
                ->header('Content-Type', $file->mime_type)
                ->header('Content-Disposition', 'inline; filename="'.$file->original_name.'"')
                ->header('Cache-Control', 'no-store, private');
        }

        if (! $this->watermark->isWatermarkable($file->mime_type)) {
            return response()->json([
                'message' => 'Pratinjau berwatermark tidak tersedia untuk jenis berkas ini. Hubungi Document Controller untuk salinan resmi.',
            ], 415);
        }

        $result = $this->watermark->watermark($absolutePath, $file->mime_type);

        $this->audit->log($request->user(), 'view', 'DocumentFile', (string) $file->id, $document->code,
            "Melihat berkas \"{$file->original_name}\" dari {$document->code} (uncontrolled copy)");

        return response($result['content'])
            ->header('Content-Type', $result['mime'])
            ->header('Content-Disposition', 'inline; filename="uncontrolled-copy-'.$file->original_name.'"')
            ->header('Cache-Control', 'no-store, private');
    }

    /** Memeriksa berkas di disk masih identik dengan saat diunggah. */
    public function verify(Request $request, Document $document, DocumentFile $file): JsonResponse
    {
        $this->authorize('downloadFile', $document);

        if ($file->document_id !== $document->id) {
            return response()->json(['message' => 'Berkas tidak ditemukan pada dokumen ini.'], 404);
        }

        return response()->json([
            'exists' => $file->exists(),
            'intact' => $file->verifyChecksum(),
            'checksum_sha256' => $file->checksum_sha256,
        ]);
    }

    public function destroy(Request $request, Document $document, DocumentFile $file): JsonResponse
    {
        $this->authorize('uploadFile', $document);

        if ($file->document_id !== $document->id) {
            return response()->json(['message' => 'Berkas tidak ditemukan pada dokumen ini.'], 404);
        }

        // Berkas fisik sengaja TIDAK dihapus dari disk: baris di database
        // di-soft-delete agar riwayat tetap dapat ditelusuri saat audit.
        $file->delete();

        $this->audit->log($request->user(), 'delete', 'DocumentFile', (string) $file->id, $document->code,
            "Menghapus berkas \"{$file->original_name}\" dari {$document->code}");

        return response()->json(['message' => 'Berkas dihapus dari dokumen.']);
    }
}
