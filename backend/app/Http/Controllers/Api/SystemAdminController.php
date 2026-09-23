<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Models\AuditLog;
use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\DraftingProject;
use App\Models\Finding;
use App\Models\LegalRequirement;
use App\Models\Record;
use App\Models\Risk;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\LicenseService;
use App\Support\Permissions;
use Illuminate\Foundation\Application;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * System Administration — panel kesehatan & konfigurasi untuk sysadmin.
 * Hanya MEMBACA konfigurasi (tidak pernah menampilkan nilai rahasia seperti
 * APP_KEY/password DB/SMTP), plus satu aksi aman: bersihkan cache aplikasi.
 * Tidak ada aksi yang mengubah .env atau menjalankan perintah bebas.
 */
class SystemAdminController extends Controller
{
    public function __construct(private AuditLogger $audit, private LicenseService $license) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::SYSTEM_ADMIN)) {
            return response()->json(['message' => 'Hanya System Administrator yang boleh membuka panel ini.'], 403);
        }

        return response()->json([
            'runtime' => $this->runtime(),
            'checks' => $this->securityChecks(),
            'storage' => $this->storage(),
            'volumes' => $this->volumes(),
            'errors' => $this->recentErrors(),
        ]);
    }

    public function clearCache(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::SYSTEM_ADMIN)) {
            return response()->json(['message' => 'Hanya System Administrator yang boleh membersihkan cache.'], 403);
        }

        // Hanya cache data & view — cache config/route dibiarkan (dibangun ulang saat deploy),
        // karena membersihkannya dari request web tanpa membangun ulang memperlambat semua request.
        Artisan::call('cache:clear');
        Artisan::call('view:clear');

        $this->audit->log($request->user(), 'update', 'System', null, 'Cache', 'Membersihkan cache aplikasi & view dari panel System Administration.');

        return response()->json(['cleared' => true]);
    }

    private function runtime(): array
    {
        $dbVersion = null;
        try {
            $dbVersion = match (DB::connection()->getDriverName()) {
                'sqlite' => DB::selectOne('select sqlite_version() as v')->v,
                default => DB::selectOne('select version() as v')->v,
            };
        } catch (Throwable) {
            // versi DB hanya informasi — kegagalan membacanya tidak boleh menjatuhkan panel
        }

        return [
            'app_name' => config('app.name'),
            'environment' => app()->environment(),
            'commit' => $this->gitCommit(),
            'php' => PHP_VERSION,
            'laravel' => Application::VERSION,
            'db_driver' => DB::connection()->getDriverName(),
            'db_version' => $dbVersion,
            'timezone' => config('app.timezone'),
            'server_time' => now()->toDateTimeString(),
            'cache_store' => config('cache.default'),
            'session_driver' => config('session.driver'),
            'queue' => config('queue.default'),
            'mailer' => config('mail.default'),
            'config_cached' => app()->configurationIsCached(),
            'routes_cached' => app()->routesAreCached(),
        ];
    }

    /** Commit yang sedang berjalan — dibaca dari .git (deploy memakai git reset), tanpa menjalankan proses git. */
    private function gitCommit(): ?string
    {
        foreach ([base_path('.git'), base_path('../.git')] as $git) {
            if (! is_file("{$git}/HEAD")) {
                continue;
            }
            $head = trim((string) @file_get_contents("{$git}/HEAD"));
            if (str_starts_with($head, 'ref: ')) {
                $ref = substr($head, 5);
                $hash = is_file("{$git}/{$ref}") ? trim((string) @file_get_contents("{$git}/{$ref}")) : null;
                if (! $hash && is_file("{$git}/packed-refs") && preg_match('/^([0-9a-f]{40}) '.preg_quote($ref, '/').'$/m', (string) @file_get_contents("{$git}/packed-refs"), $m)) {
                    $hash = $m[1];
                }
            } else {
                $hash = $head;
            }

            return $hash ? substr($hash, 0, 7) : null;
        }

        return null;
    }

    private function check(string $key, string $label, bool $ok, string $detail, string $severity = 'bad'): array
    {
        return ['key' => $key, 'label' => $label, 'status' => $ok ? 'ok' : $severity, 'detail' => $detail];
    }

    private function securityChecks(): array
    {
        $production = app()->environment('production');
        $https = str_starts_with((string) config('app.url'), 'https://');
        $defaultPasswords = User::where('active', true)->where('must_change_password', true)->count();
        $locked = User::whereNotNull('locked_until')->where('locked_until', '>', now())->count();
        $licenseValid = $this->license->isValid();

        return [
            $this->check('debug', 'Mode debug dimatikan', ! config('app.debug'),
                config('app.debug') ? 'APP_DEBUG aktif — pesan error lengkap (termasuk jejak kode) bisa terlihat oleh pengguna.' : 'APP_DEBUG nonaktif.'),
            $this->check('env', 'Lingkungan produksi', $production,
                $production ? 'APP_ENV=production.' : 'APP_ENV='.app()->environment().' — gunakan production di server langsung.', 'warn'),
            $this->check('https', 'URL aplikasi memakai HTTPS', $https,
                $https ? 'APP_URL memakai https.' : 'APP_URL tidak memakai https — tautan & cookie bisa terkirim tanpa enkripsi.', 'warn'),
            $this->check('secure_cookie', 'Cookie sesi hanya lewat HTTPS', (bool) config('session.secure') || ! $production,
                config('session.secure') ? 'SESSION_SECURE_COOKIE aktif.'
                    : ($production ? 'SESSION_SECURE_COOKIE belum diaktifkan — cookie sesi bisa terkirim lewat HTTP biasa.' : 'Tidak diwajibkan di lingkungan non-produksi.'), 'warn'),
            $this->check('license', 'Lisensi aktif & sah', $licenseValid,
                $licenseValid ? 'Tanda tangan lisensi cocok dan belum kedaluwarsa.' : 'Lisensi tidak valid/kedaluwarsa — aplikasi terkunci untuk pengguna.'),
            $this->check('default_passwords', 'Tidak ada akun aktif dengan password bawaan', $defaultPasswords === 0,
                $defaultPasswords ? "{$defaultPasswords} akun aktif belum mengganti password awal." : 'Semua akun aktif sudah mengganti password awal.', 'warn'),
            $this->check('locked', 'Tidak ada akun terkunci', $locked === 0,
                $locked ? "{$locked} akun sedang terkunci karena percobaan login gagal berulang." : 'Tidak ada akun terkunci.', 'warn'),
        ];
    }

    private function storage(): array
    {
        $disk = Storage::disk('documents');
        $files = 0;
        $bytes = 0;
        foreach ($disk->allFiles() as $path) {
            $files++;
            $bytes += $disk->size($path);
        }

        $log = storage_path('logs/laravel.log');

        return [
            'documents_files' => $files,
            'documents_bytes' => $bytes,
            'registered_files' => DocumentFile::count(),
            'log_bytes' => is_file($log) ? filesize($log) : 0,
        ];
    }

    private function volumes(): array
    {
        return [
            ['label' => 'Pengguna aktif', 'value' => User::where('active', true)->count()],
            ['label' => 'Dokumen', 'value' => Document::count()],
            ['label' => 'Proyek penyusunan', 'value' => DraftingProject::count()],
            ['label' => 'Rekaman', 'value' => Record::count()],
            ['label' => 'Risiko', 'value' => Risk::count()],
            ['label' => 'Temuan', 'value' => Finding::count()],
            ['label' => 'Audit', 'value' => Audit::count()],
            ['label' => 'Peraturan (Legal Register)', 'value' => LegalRequirement::count()],
            ['label' => 'Entri audit trail', 'value' => AuditLog::count()],
        ];
    }

    /**
     * Ringkasan error terbaru dari log — HANYA baris judul (waktu, level,
     * pesan terpotong), bukan stack trace, supaya panel tidak menjadi
     * tempat menampilkan data sensitif yang mungkin ikut tercatat.
     */
    private function recentErrors(): array
    {
        $log = storage_path('logs/laravel.log');
        if (! is_file($log)) {
            return [];
        }

        $size = filesize($log);
        $fh = fopen($log, 'r');
        fseek($fh, max(0, $size - 512 * 1024)); // cukup 512 KB terakhir
        $tail = stream_get_contents($fh);
        fclose($fh);

        preg_match_all('/^\[(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})[^\]]*\] \w+\.(ERROR|CRITICAL|ALERT|EMERGENCY): (.{0,200})/m', $tail, $m, PREG_SET_ORDER);

        return collect($m)->map(fn ($x) => ['time' => $x[1], 'level' => $x[2], 'message' => trim($x[3])])
            ->reverse()->take(10)->values()->all();
    }
}
