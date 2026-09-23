<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiGeneration;
use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\DocumentRevision;
use App\Models\DraftingMeeting;
use App\Models\DraftingMeetingAttendee;
use App\Models\DraftingMeetingPhoto;
use App\Models\DraftingProject;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\DocumentNumbering;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tracking Penyusunan Dokumen — 8 tahap PRD §5. Alur status proyek:
 *   requested → in_progress (drafter ditugaskan) → finalized → ratified
 *   requested/in_progress → rejected (Document Controller, wajib alasan)
 *   finalized → in_progress (dikembalikan pengesah, wajib catatan)
 *
 * Pengesahan membuat Document baru berstatus Released Rev 0 lewat jalur
 * yang sama dengan pembuatan dokumen biasa (DocumentNumbering, revisi 0,
 * DocumentFile ber-checksum di disk privat) — PDF final dari tahap
 * finalisasi menjadi berkas utamanya, sehingga aturan "terkontrol wajib
 * PDF" (DocumentLifecycle::assertReadyForRelease) tetap terpenuhi.
 */
class DraftingProjectController extends Controller
{
    private const DOC_TYPES = ['Kebijakan', 'Manual', 'SOP', 'Work Instruction', 'Formulir'];
    private const CLASSIFICATIONS = ['public', 'internal', 'restricted', 'confidential', 'secret', 'top_secret'];
    private const INVOLVED = [
        Permissions::DOCUMENT_DRAFT, Permissions::DOCUMENT_CONTROL, Permissions::DOCUMENT_RATIFY,
        Permissions::DOCUMENT_REVIEW, Permissions::DOCUMENT_APPROVE, Permissions::AUDIT_VIEW,
    ];
    private const MAX_KB = 25600;

    public function __construct(private AuditLogger $audit, private DocumentNumbering $numbering) {}

    // ---- Proyek ---------------------------------------------------------

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $involved = $this->involved($user);
        if (! $involved && ! $user->hasPermission(Permissions::DOCUMENT_REQUEST)) {
            return response()->json(['message' => 'Anda tidak berwenang melihat Tracking Penyusunan Dokumen.'], 403);
        }

        $query = DraftingProject::query()->with([
            'orgFunction:id,name', 'requester:id,name', 'drafter:id,name', 'standards:code,name',
            'meetings.attendees:id,drafting_meeting_id,signed_at',
        ]);
        if (! $involved) {
            $query->where('requester_id', $user->id); // pemohon murni hanya melihat permintaannya sendiri
        }
        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }
        if ($request->boolean('mine')) {
            $query->where(fn ($q) => $q->where('drafter_id', $user->id)->orWhere('requester_id', $user->id));
        }

        $projects = $query->orderByDesc('id')->get();

        return response()->json([
            'projects' => $projects,
            'stage_labels' => DraftingProject::STAGE_LABELS,
            'can' => [
                'request' => $this->canRequest($user),
                'take' => $user->hasPermission(Permissions::DOCUMENT_DRAFT),
                'control' => $user->hasPermission(Permissions::DOCUMENT_CONTROL),
                'ratify' => $user->hasPermission(Permissions::DOCUMENT_RATIFY),
            ],
            'drafters' => $user->hasPermission(Permissions::DOCUMENT_CONTROL) ? $this->drafters() : [],
            'meta' => ['doc_types' => self::DOC_TYPES, 'classifications' => self::CLASSIFICATIONS],
        ]);
    }

    public function show(Request $request, DraftingProject $project): JsonResponse
    {
        if (! $this->canView($request->user(), $project)) {
            return response()->json(['message' => 'Anda tidak berwenang melihat proyek ini.'], 403);
        }

        $user = $request->user();

        return response()->json([
            'project' => $this->present($project),
            'stage_labels' => DraftingProject::STAGE_LABELS,
            'gaps' => $project->status === 'in_progress' || $project->status === 'finalized' ? $project->completenessGaps() : [],
            'can' => [
                'work' => $this->canWork($user, $project),
                'take' => $user->hasPermission(Permissions::DOCUMENT_DRAFT) && in_array($project->status, ['requested', 'in_progress'], true)
                    && (! $project->drafter_id || $project->drafter_id === $user->id),
                'control' => $user->hasPermission(Permissions::DOCUMENT_CONTROL),
                'ratify' => $user->hasPermission(Permissions::DOCUMENT_RATIFY),
                'edit' => $this->ownsOrControls($user, $project) && in_array($project->status, ['requested', 'in_progress'], true),
                'delete' => $this->ownsOrControls($user, $project) && in_array($project->status, ['requested', 'rejected'], true),
            ],
            'drafters' => $user->hasPermission(Permissions::DOCUMENT_CONTROL) ? $this->drafters() : [],
            'meta' => ['doc_types' => self::DOC_TYPES, 'classifications' => self::CLASSIFICATIONS],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $this->canRequest($user)) {
            return response()->json(['message' => 'Anda tidak berwenang mengajukan permintaan dokumen.'], 403);
        }

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'doc_type' => ['required', Rule::in(self::DOC_TYPES)],
            'function_id' => ['required', 'exists:org_functions,id'],
            'classification' => ['required', Rule::in(self::CLASSIFICATIONS)],
            'reason' => ['required', 'string', 'max:5000'],
            'standards' => ['sometimes', 'array'],
            'standards.*' => ['string', 'exists:standards,code'],
            'ai_generation_id' => ['sometimes', 'nullable', 'integer'],
        ]);

        // Permintaan yang berasal dari Asisten AI: rancangan AI (hanya milik
        // pengguna ini) dipakai sebagai draf awal, dan hasil AI ditandai
        // "ditindaklanjuti" untuk KPI adopsi.
        $generation = isset($data['ai_generation_id'])
            ? AiGeneration::whereKey($data['ai_generation_id'])->where('user_id', $user->id)->first()
            : null;

        $project = DB::transaction(function () use ($data, $user, $generation) {
            $project = DraftingProject::create([
                'code' => DraftingProject::nextCode(),
                'status' => 'requested',
                'requester_id' => $user->id,
                'final_content' => $generation?->kind === 'draft' ? AiAssistantController::renderDraft($generation->result ?? []) : null,
                ...collect($data)->except(['standards', 'ai_generation_id'])->all(),
            ]);
            $project->standards()->sync($data['standards'] ?? []);
            AiGeneration::markFollowedUp($generation?->id, $user->id, $project->code);

            return $project;
        });

        $this->log($user, $project, 'create', "Mengajukan permintaan penyusunan \"{$project->title}\" ({$project->code}).");

        return response()->json($this->present($project), 201);
    }

    /** Ubah data permintaan — oleh pemohon atau Document Controller, selama belum difinalisasi. */
    public function update(Request $request, DraftingProject $project): JsonResponse
    {
        $user = $request->user();
        if (! $this->ownsOrControls($user, $project)) {
            return $this->forbidden('Hanya pemohon atau Document Controller yang boleh mengubah permintaan ini.');
        }
        if (! in_array($project->status, ['requested', 'in_progress'], true)) {
            return $this->fail('Permintaan yang sudah difinalisasi/disahkan/ditolak tidak bisa diubah.');
        }

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'doc_type' => ['sometimes', Rule::in(self::DOC_TYPES)],
            'function_id' => ['sometimes', 'exists:org_functions,id'],
            'classification' => ['sometimes', Rule::in(self::CLASSIFICATIONS)],
            'reason' => ['sometimes', 'string', 'max:5000'],
            'standards' => ['sometimes', 'array'],
            'standards.*' => ['string', 'exists:standards,code'],
        ]);

        DB::transaction(function () use ($project, $data) {
            $project->fill(collect($data)->except('standards')->all())->save();
            if (array_key_exists('standards', $data)) {
                $project->standards()->sync($data['standards']);
            }
        });
        $this->log($user, $project, 'update', "Mengubah data permintaan penyusunan \"{$project->title}\" ({$project->code}).");

        return response()->json($this->present($project->fresh()));
    }

    /** Hapus permintaan yang belum dikerjakan (atau sudah ditolak) — oleh pemohon atau Document Controller. */
    public function destroy(Request $request, DraftingProject $project): JsonResponse
    {
        $user = $request->user();
        if (! $this->ownsOrControls($user, $project)) {
            return $this->forbidden('Hanya pemohon atau Document Controller yang boleh menghapus permintaan ini.');
        }
        if (! in_array($project->status, ['requested', 'rejected'], true)) {
            return $this->fail('Hanya permintaan yang belum dikerjakan atau sudah ditolak yang bisa dihapus. Proyek yang sedang berjalan bisa ditolak oleh Document Controller.');
        }

        DB::transaction(function () use ($project) {
            $project->meetings()->delete();
            $project->delete();
        });
        $this->log($user, $project, 'delete', "Menghapus permintaan penyusunan \"{$project->title}\" ({$project->code}).");

        return response()->json(['message' => 'Permintaan dihapus.']);
    }

    public function assign(Request $request, DraftingProject $project): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate(['drafter_id' => ['nullable', 'integer', 'exists:users,id']]);

        if (! in_array($project->status, ['requested', 'in_progress'], true)) {
            return $this->fail('Penyusun hanya bisa ditetapkan sebelum finalisasi.');
        }

        if (isset($data['drafter_id']) && $data['drafter_id'] !== $user->id) {
            if (! $user->hasPermission(Permissions::DOCUMENT_CONTROL)) {
                return $this->forbidden('Hanya Document Controller yang boleh menugaskan penyusun lain.');
            }
            $drafter = User::findOrFail($data['drafter_id']);
            if (! $drafter->hasPermission(Permissions::DOCUMENT_DRAFT)) {
                return $this->fail('Pengguna yang dipilih bukan penyusun dokumen (Drafter).');
            }
        } else {
            if (! $user->hasPermission(Permissions::DOCUMENT_DRAFT)) {
                return $this->forbidden('Hanya penyusun dokumen yang bisa mengambil permintaan.');
            }
            if ($project->drafter_id && $project->drafter_id !== $user->id) {
                return $this->fail('Permintaan ini sudah ditangani penyusun lain.');
            }
            $drafter = $user;
        }

        $project->update(['drafter_id' => $drafter->id, 'status' => 'in_progress']);
        $this->log($user, $project, 'update', "Menetapkan {$drafter->name} sebagai penyusun {$project->code}.");

        return response()->json($this->present($project->fresh()));
    }

    public function reject(Request $request, DraftingProject $project): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::DOCUMENT_CONTROL)) {
            return $this->forbidden('Hanya Document Controller yang boleh menolak permintaan.');
        }
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        if (! in_array($project->status, ['requested', 'in_progress'], true)) {
            return $this->fail('Proyek pada status ini tidak bisa ditolak.');
        }

        $project->update(['status' => 'rejected', 'rejection_reason' => $data['reason']]);
        $this->log($request->user(), $project, 'update', "Menolak permintaan {$project->code}: {$data['reason']}");

        return response()->json($this->present($project->fresh()));
    }

    public function finalize(Request $request, DraftingProject $project): JsonResponse
    {
        if (! $this->canWork($request->user(), $project)) {
            return $this->forbidden('Hanya penyusun proyek ini (atau Document Controller) yang boleh finalisasi.');
        }

        $request->validate([
            'final_content' => ['nullable', 'string'],
            'file' => [$project->final_file_path ? 'nullable' : 'required', 'file', 'max:'.self::MAX_KB, 'mimetypes:application/pdf'],
        ], [
            'file.required' => 'Unggah berkas final dokumen (PDF).',
            'file.mimetypes' => 'Berkas final wajib PDF — dokumen terkontrol harus PDF agar bisa diberi watermark.',
        ]);

        if ($gaps = $project->completenessGaps()) {
            return response()->json(['message' => 'Tahap rapat belum lengkap.', 'gaps' => $gaps], 422);
        }

        if ($file = $request->file('file')) {
            $path = $this->storeUpload($file, "drafting/{$project->id}/final");
            $project->fill([
                'final_file_path' => $path,
                'final_file_name' => $file->getClientOriginalName(),
                'final_file_size' => $file->getSize(),
                'final_file_checksum' => hash_file('sha256', $file->getRealPath()),
            ]);
        }
        $project->fill([
            'final_content' => $request->input('final_content', $project->final_content),
            'status' => 'finalized',
            'finalized_at' => now(),
            'return_note' => null,
        ])->save();

        $this->log($request->user(), $project, 'update', "Memfinalisasi draf {$project->code}.");

        return response()->json($this->present($project->fresh()));
    }

    public function returnToDrafter(Request $request, DraftingProject $project): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::DOCUMENT_RATIFY)) {
            return $this->forbidden('Hanya pengesah yang boleh mengembalikan finalisasi.');
        }
        $data = $request->validate(['note' => ['required', 'string', 'max:2000']]);
        if ($project->status !== 'finalized') {
            return $this->fail('Hanya proyek berstatus finalisasi yang bisa dikembalikan.');
        }

        $project->update(['status' => 'in_progress', 'return_note' => $data['note'], 'finalized_at' => null]);
        $this->log($request->user(), $project, 'update', "Mengembalikan {$project->code} ke penyusun: {$data['note']}");

        return response()->json($this->present($project->fresh()));
    }

    public function ratify(Request $request, DraftingProject $project): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasPermission(Permissions::DOCUMENT_RATIFY)) {
            return $this->forbidden('Hanya pengesah (Ratifier) yang boleh mengesahkan dokumen.');
        }
        if ($project->status !== 'finalized') {
            return $this->fail('Hanya proyek berstatus finalisasi yang bisa disahkan.');
        }
        if ($gaps = $project->completenessGaps()) {
            return response()->json(['message' => 'Kelengkapan jejak penyusunan belum terpenuhi.', 'gaps' => $gaps], 422);
        }
        if (! $project->final_file_path || ! Storage::disk('documents')->exists($project->final_file_path)) {
            return $this->fail('Berkas final (PDF) tidak ditemukan.');
        }

        $document = DB::transaction(function () use ($project, $user) {
            $document = Document::create([
                'code' => $this->numbering->nextCode($project->doc_type, $project->function_id),
                'title' => $project->title,
                'type' => $project->doc_type,
                'function_id' => $project->function_id,
                'classification' => $project->classification,
                'status' => 'released',
                'validity' => 'berlaku',
                'version' => '1.0',
                'revision_number' => 0,
                'effective_date' => now()->toDateString(),
                'review_date' => now()->addYear()->toDateString(), // sama dengan DocumentLifecycle saat release
                'keywords' => [],
                'content' => $project->final_content,
                'owner_id' => $project->drafter_id ?? $user->id,
                'created_by' => $user->id,
            ]);
            $document->standards()->sync($project->standards()->pluck('standards.code')->all());

            $revision = DocumentRevision::create([
                'document_id' => $document->id,
                'revision_number' => 0,
                'version' => '1.0',
                'date' => now()->toDateString(),
                'editor_id' => $user->id,
                'editor_name' => $user->name,
                'notes' => "Disahkan dari proyek penyusunan {$project->code}",
                'status' => 'released',
                'content_snapshot' => $document->content,
            ]);

            $storedPath = sprintf('documents/%s/%s/%s.pdf', now()->format('Y'), $document->id, Str::ulid());
            Storage::disk('documents')->copy($project->final_file_path, $storedPath);

            DocumentFile::create([
                'document_id' => $document->id,
                'document_revision_id' => $revision->id,
                'original_name' => $project->final_file_name,
                'disk' => 'documents',
                'stored_path' => $storedPath,
                'mime_type' => 'application/pdf',
                'size_bytes' => $project->final_file_size,
                'checksum_sha256' => $project->final_file_checksum,
                'is_primary' => true,
                'uploaded_by' => $user->id,
                'uploaded_by_name' => $user->name,
            ]);

            $project->update([
                'status' => 'ratified', 'ratified_by' => $user->id, 'ratified_at' => now(), 'document_id' => $document->id,
            ]);

            $this->audit->log($user, 'create', 'Document', (string) $document->id, $document->code,
                "Mengesahkan \"{$document->title}\" ({$document->code}) dari proyek penyusunan {$project->code} — langsung Released Rev 0.");
            $this->log($user, $project, 'update', "Mengesahkan {$project->code} menjadi dokumen {$document->code}.");

            return $document;
        });

        return response()->json(['project' => $this->present($project->fresh()), 'document' => $document->only(['id', 'code', 'title'])]);
    }

    public function finalFile(Request $request, DraftingProject $project): Response
    {
        abort_unless($this->canView($request->user(), $project) && $project->final_file_path, 404);

        return Storage::disk('documents')->response($project->final_file_path, $project->final_file_name, [], 'inline');
    }

    // ---- Rapat ----------------------------------------------------------

    public function storeMeeting(Request $request, DraftingProject $project): JsonResponse
    {
        if (! $this->canWork($request->user(), $project)) {
            return $this->forbidden('Hanya penyusun proyek ini (atau Document Controller) yang boleh menjadwalkan rapat.');
        }
        $data = $request->validate([
            'agenda' => ['required', 'string', 'max:255'],
            'scheduled_at' => ['required', 'date'],
            'location' => ['nullable', 'string', 'max:255'],
        ]);

        $meeting = DB::transaction(function () use ($project, $data, $request) {
            $next = (int) $project->meetings()->withTrashed()->lockForUpdate()->max('session_no') + 1;

            return DraftingMeeting::create([
                ...$data, 'drafting_project_id' => $project->id, 'session_no' => $next, 'created_by' => $request->user()->id,
            ]);
        });
        $this->log($request->user(), $project, 'update', "Menjadwalkan rapat pembahasan ke-{$meeting->session_no} untuk {$project->code}.");

        return response()->json($meeting, 201);
    }

    public function updateMeeting(Request $request, DraftingProject $project, DraftingMeeting $meeting): JsonResponse
    {
        $this->assertMeeting($project, $meeting);
        if (! $this->canWork($request->user(), $project)) {
            return $this->forbidden('Anda tidak berwenang mengubah rapat ini.');
        }
        $data = $request->validate([
            'agenda' => ['sometimes', 'string', 'max:255'],
            'scheduled_at' => ['sometimes', 'date'],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'held' => ['sometimes', 'boolean'],
            'budget' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:9999999999999'],
            'minutes' => ['sometimes', 'nullable', 'string', 'max:20000'],
        ]);

        if (array_key_exists('held', $data)) {
            $meeting->held_at = $data['held'] ? ($meeting->held_at ?? now()) : null;
            unset($data['held']);
        }
        $meeting->fill($data)->save();
        $this->log($request->user(), $project, 'update', "Memperbarui rapat ke-{$meeting->session_no} {$project->code}.");

        return response()->json($meeting->fresh()->load(['photos', 'attendees']));
    }

    /** Rapat yang daftar hadirnya sudah ditandatangani adalah bukti proses — tidak bisa dihapus. */
    public function destroyMeeting(Request $request, DraftingProject $project, DraftingMeeting $meeting): JsonResponse
    {
        $this->assertMeeting($project, $meeting);
        if (! $this->canWork($request->user(), $project)) {
            return $this->forbidden('Anda tidak berwenang menghapus rapat ini.');
        }
        if ($meeting->attendees()->whereNotNull('signed_at')->exists()) {
            return $this->fail('Rapat yang daftar hadirnya sudah ditandatangani tidak bisa dihapus.');
        }

        DB::transaction(function () use ($meeting) {
            $meeting->attendees()->delete();
            $meeting->delete();
        });
        $this->log($request->user(), $project, 'delete', "Menghapus rapat ke-{$meeting->session_no} {$project->code} ({$meeting->agenda}).");

        return response()->json(['message' => 'Rapat dihapus.']);
    }

    public function uploadMinutes(Request $request, DraftingProject $project, DraftingMeeting $meeting): JsonResponse
    {
        $this->assertMeeting($project, $meeting);
        if (! $this->canWork($request->user(), $project)) {
            return $this->forbidden('Anda tidak berwenang mengunggah bukti notulen.');
        }
        $request->validate(['file' => ['required', 'file', 'max:'.self::MAX_KB, 'mimetypes:application/pdf,image/png,image/jpeg']],
            ['file.mimetypes' => 'Bukti notulen harus PDF atau gambar (PNG/JPG).']);

        $file = $request->file('file');
        $meeting->update([
            'minutes_file_path' => $this->storeUpload($file, "drafting/{$project->id}/minutes"),
            'minutes_file_name' => $file->getClientOriginalName(),
        ]);
        $this->log($request->user(), $project, 'upload', "Mengunggah bukti notulen rapat ke-{$meeting->session_no} {$project->code}.");

        return response()->json($meeting->fresh());
    }

    public function minutesFile(Request $request, DraftingProject $project, DraftingMeeting $meeting): Response
    {
        $this->assertMeeting($project, $meeting);
        abort_unless($this->canView($request->user(), $project) && $meeting->minutes_file_path, 404);

        return Storage::disk('documents')->response($meeting->minutes_file_path, $meeting->minutes_file_name, [], 'inline');
    }

    public function uploadPhoto(Request $request, DraftingProject $project, DraftingMeeting $meeting): JsonResponse
    {
        $this->assertMeeting($project, $meeting);
        if (! $this->canWork($request->user(), $project)) {
            return $this->forbidden('Anda tidak berwenang mengunggah foto rapat.');
        }
        $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimetypes:image/png,image/jpeg'],
            'caption' => ['nullable', 'string', 'max:255'],
        ], ['file.mimetypes' => 'Foto harus PNG atau JPG.']);

        $file = $request->file('file');
        $photo = DraftingMeetingPhoto::create([
            'drafting_meeting_id' => $meeting->id,
            'path' => $this->storeUpload($file, "drafting/{$project->id}/photos"),
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'caption' => $request->input('caption'),
        ]);

        return response()->json($photo, 201);
    }

    public function photo(Request $request, DraftingProject $project, DraftingMeeting $meeting, DraftingMeetingPhoto $photo): Response
    {
        $this->assertMeeting($project, $meeting);
        abort_unless($photo->drafting_meeting_id === $meeting->id && $this->canView($request->user(), $project), 404);

        return Storage::disk('documents')->response($photo->path, $photo->original_name, ['Content-Type' => $photo->mime_type], 'inline');
    }

    public function storeAttendee(Request $request, DraftingProject $project, DraftingMeeting $meeting): JsonResponse
    {
        $this->assertMeeting($project, $meeting);
        if (! $this->canWork($request->user(), $project)) {
            return $this->forbidden('Anda tidak berwenang mengisi daftar hadir.');
        }
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'position' => ['nullable', 'string', 'max:255'],
            'signature' => ['nullable', ...$this->signatureRule()],
        ]);

        $attendee = DraftingMeetingAttendee::create([
            ...$data, 'drafting_meeting_id' => $meeting->id, 'signed_at' => isset($data['signature']) ? now() : null,
        ]);

        return response()->json($attendee, 201);
    }

    public function signAttendee(Request $request, DraftingProject $project, DraftingMeeting $meeting, DraftingMeetingAttendee $attendee): JsonResponse
    {
        $this->assertMeeting($project, $meeting);
        abort_unless($attendee->drafting_meeting_id === $meeting->id, 404);
        if (! $this->canWork($request->user(), $project)) {
            return $this->forbidden('Anda tidak berwenang merekam tanda tangan.');
        }
        $data = $request->validate(['signature' => ['required', ...$this->signatureRule()]]);

        $attendee->update(['signature' => $data['signature'], 'signed_at' => now()]);

        return response()->json($attendee->fresh());
    }

    public function updateAttendee(Request $request, DraftingProject $project, DraftingMeeting $meeting, DraftingMeetingAttendee $attendee): JsonResponse
    {
        $this->assertMeeting($project, $meeting);
        abort_unless($attendee->drafting_meeting_id === $meeting->id, 404);
        if (! $this->canWork($request->user(), $project)) {
            return $this->forbidden('Anda tidak berwenang mengubah daftar hadir.');
        }
        if ($attendee->signed_at) {
            return $this->fail('Peserta yang sudah menandatangani tidak bisa diubah.');
        }

        $attendee->update($request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'position' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]));

        return response()->json($attendee->fresh());
    }

    public function destroyAttendee(Request $request, DraftingProject $project, DraftingMeeting $meeting, DraftingMeetingAttendee $attendee): JsonResponse
    {
        $this->assertMeeting($project, $meeting);
        abort_unless($attendee->drafting_meeting_id === $meeting->id, 404);
        if (! $this->canWork($request->user(), $project)) {
            return $this->forbidden('Anda tidak berwenang mengubah daftar hadir.');
        }
        if ($attendee->signed_at) {
            return $this->fail('Peserta yang sudah menandatangani tidak bisa dihapus dari daftar hadir.');
        }

        $attendee->delete();
        $this->log($request->user(), $project, 'update', "Menghapus peserta \"{$attendee->name}\" dari daftar hadir rapat ke-{$meeting->session_no} {$project->code}.");

        return response()->json(['message' => 'Peserta dihapus.']);
    }

    public function signature(Request $request, DraftingProject $project, DraftingMeeting $meeting, DraftingMeetingAttendee $attendee): Response
    {
        $this->assertMeeting($project, $meeting);
        abort_unless($attendee->drafting_meeting_id === $meeting->id && $attendee->signature && $this->canView($request->user(), $project), 404);

        $png = base64_decode(substr($attendee->signature, strlen('data:image/png;base64,')), true);

        return response($png, 200, ['Content-Type' => 'image/png', 'Cache-Control' => 'private, max-age=300']);
    }

    // ---- Helper ---------------------------------------------------------

    private function present(DraftingProject $project): DraftingProject
    {
        return $project->load([
            'orgFunction:id,name', 'requester:id,name', 'drafter:id,name', 'ratifier:id,name',
            'standards:code,name', 'document:id,code,title,status',
            'meetings.photos', 'meetings.attendees',
        ]);
    }

    private function storeUpload(UploadedFile $file, string $dir): string
    {
        $path = sprintf('%s/%s.%s', $dir, Str::ulid(), strtolower($file->getClientOriginalExtension() ?: 'bin'));
        Storage::disk('documents')->put($path, file_get_contents($file->getRealPath()));

        return $path;
    }

    /** @return list<string> */
    private function signatureRule(): array
    {
        // PNG data URL dari kanvas; batas ~300 KB mencegah gambar raksasa masuk DB.
        return ['string', 'max:400000', 'regex:/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/'];
    }

    private function ownsOrControls(User $user, DraftingProject $project): bool
    {
        return $project->requester_id === $user->id || $user->hasPermission(Permissions::DOCUMENT_CONTROL);
    }

    private function assertMeeting(DraftingProject $project, DraftingMeeting $meeting): void
    {
        abort_unless($meeting->drafting_project_id === $project->id, 404);
    }

    private function involved(User $user): bool
    {
        foreach (self::INVOLVED as $permission) {
            if ($user->hasPermission($permission)) {
                return true;
            }
        }

        return false;
    }

    private function canRequest(User $user): bool
    {
        return $user->hasPermission(Permissions::DOCUMENT_REQUEST)
            || $user->hasPermission(Permissions::DOCUMENT_DRAFT)
            || $user->hasPermission(Permissions::DOCUMENT_CONTROL);
    }

    private function canView(User $user, DraftingProject $project): bool
    {
        return $this->involved($user) || $project->requester_id === $user->id;
    }

    private function canWork(User $user, DraftingProject $project): bool
    {
        return $project->status === 'in_progress'
            && ($project->drafter_id === $user->id || $user->hasPermission(Permissions::DOCUMENT_CONTROL));
    }

    private function drafters(): array
    {
        return User::where('active', true)->with('roles:id')->orderBy('name')->get(['id', 'name'])
            ->filter(fn (User $u) => $u->hasPermission(Permissions::DOCUMENT_DRAFT))
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name])->values()->all();
    }

    private function log(User $user, DraftingProject $project, string $action, string $detail): void
    {
        $this->audit->log($user, $action, 'DraftingProject', $project->code, $project->title, $detail);
    }

    private function fail(string $message): JsonResponse
    {
        return response()->json(['message' => $message], 422);
    }

    private function forbidden(string $message): JsonResponse
    {
        return response()->json(['message' => $message], 403);
    }
}
