<?php

namespace App\Http\Middleware;

use App\Services\LicenseService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gerbang lisensi — didaftarkan sebagai middleware GLOBAL paling depan
 * (lihat bootstrap/app.php), bukan lewat alias yang ditempel di grup rute
 * tertentu. Ini SENGAJA, karena middleware yang ditempel di dalam
 * routes/api.php ternyata tetap bisa "didahului" oleh middleware bawaan
 * Laravel seperti VerifyCsrfToken atau Authenticate akibat urutan
 * penggabungan grup + pengurutan prioritas middleware Laravel — dengan jadi
 * middleware global paling depan, blokir ini pasti jalan duluan untuk
 * SEMUA request, tanpa bergantung pada bagaimana rute lain disusun nanti.
 *
 * Hanya dua path yang dikecualikan (lihat EXEMPT_PATHS) — keduanya publik
 * dan tidak mengekspos data sensitif: satu untuk menampilkan status lisensi
 * ke frontend, satu untuk menerima pembaruan lisensi dari tool vendor
 * (yang diautentikasi lewat tanda tangan HMAC di body-nya sendiri, bukan
 * lewat sesi).
 */
class EnsureLicenseActive
{
    private const EXEMPT_PATHS = ['api/license-status', 'api/license/apply'];

    public function __construct(private LicenseService $license) {}

    public function handle(Request $request, Closure $next): Response
    {
        // Rute non-api (shell SPA, health check /up) sengaja dibiarkan lewat
        // apa pun status lisensinya — React-lah yang menampilkan layar blokir
        // (lihat LicenseGate.jsx), dan untuk itu ia perlu bisa memuat
        // index.html + bundle JS-nya terlebih dahulu.
        if (! $request->is('api/*') || $request->is(self::EXEMPT_PATHS)) {
            return $next($request);
        }

        if (! $this->license->isValid()) {
            return response()->json([
                'message' => 'Lisensi tidak aktif atau sudah kedaluwarsa. Hubungi penyedia layanan.',
                'license_invalid' => true,
            ], 402);
        }

        return $next($request);
    }
}
