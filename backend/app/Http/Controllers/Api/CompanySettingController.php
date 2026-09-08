<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanySetting;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CompanySettingController extends Controller
{
    /** Sengaja daftar putih, sama seperti unggah berkas dokumen. */
    private const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

    private const MAX_KB = 2048; // 2 MB — cukup untuk logo, bukan foto/scan

    /** Batas lebar logo di halaman login (piksel) — sesuai rentang slider di UI. */
    private const MIN_LOGO_WIDTH = 60;

    private const MAX_LOGO_WIDTH = 320;

    public function __construct(private AuditLogger $audit) {}

    /** Publik (tanpa sesi) — logo & nama perusahaan wajib tampil di halaman login. */
    public function show(): JsonResponse
    {
        $setting = CompanySetting::current();

        return response()->json([
            'name' => $setting->name,
            'logo_url' => $setting->hasLogo() ? route('company-settings.logo') : null,
            'logo_width' => $setting->logo_width,
        ]);
    }

    /** Streaming berkas logo. Publik juga, dengan alasan yang sama seperti show(). */
    public function logo(): StreamedResponse|JsonResponse
    {
        $setting = CompanySetting::current();

        if (! $setting->hasLogo()) {
            return response()->json(['message' => 'Logo belum diunggah.'], 404);
        }

        return Storage::disk('company')->response($setting->logo_stored_path, $setting->logo_original_name, [
            'Content-Type' => $setting->logo_mime_type,
            'Cache-Control' => 'public, max-age=300',
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasPermission(Permissions::MASTERDATA_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang mengubah pengaturan perusahaan.'], 403);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'logo' => ['nullable', 'file', 'max:'.self::MAX_KB, 'mimetypes:'.implode(',', self::ALLOWED_MIMES)],
            'logo_width' => ['nullable', 'integer', 'between:'.self::MIN_LOGO_WIDTH.','.self::MAX_LOGO_WIDTH],
        ], [
            'logo.mimetypes' => 'Jenis berkas tidak didukung. Gunakan PNG, JPG, SVG, atau WEBP.',
            'logo.max' => 'Ukuran logo melebihi 2 MB.',
            'logo_width.between' => 'Ukuran logo harus antara '.self::MIN_LOGO_WIDTH.' dan '.self::MAX_LOGO_WIDTH.' piksel.',
        ]);

        $setting = CompanySetting::current();
        $oldPath = $setting->logo_stored_path;
        $setting->name = $data['name'];
        if (array_key_exists('logo_width', $data) && $data['logo_width'] !== null) {
            $setting->logo_width = $data['logo_width'];
        }

        if ($request->hasFile('logo')) {
            $upload = $request->file('logo');
            $storedPath = sprintf('logo/%s.%s', Str::ulid(), strtolower($upload->getClientOriginalExtension() ?: 'png'));
            Storage::disk('company')->put($storedPath, file_get_contents($upload->getRealPath()));

            $setting->logo_original_name = $upload->getClientOriginalName();
            $setting->logo_stored_path = $storedPath;
            $setting->logo_mime_type = $upload->getMimeType();
        }

        $setting->updated_by = $user->id;
        $setting->save();

        // Baru dihapus SETELAH baris baru tersimpan, supaya kalau proses ini
        // gagal di tengah jalan, logo lama tidak ikut hilang tanpa pengganti.
        if ($oldPath && $oldPath !== $setting->logo_stored_path) {
            Storage::disk('company')->delete($oldPath);
        }

        $this->audit->log($user, 'update', 'CompanySetting', '1', $setting->name,
            'Memperbarui pengaturan perusahaan'.($request->hasFile('logo') ? ' (termasuk logo baru)' : ''));

        return response()->json([
            'name' => $setting->name,
            'logo_url' => $setting->hasLogo() ? route('company-settings.logo') : null,
            'logo_width' => $setting->logo_width,
        ]);
    }
}
