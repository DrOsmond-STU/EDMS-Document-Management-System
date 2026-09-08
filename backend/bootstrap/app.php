<?php

use App\Http\Middleware\EnsureLicenseActive;
use App\Http\Middleware\EnsurePasswordChanged;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            // Rute API sengaja memakai grup "web" (sesi + CSRF), bukan token.
            // Frontend React disajikan dari origin yang sama dengan API, jadi
            // cookie sesi httpOnly lebih aman daripada menyimpan token di
            // localStorage yang bisa terbaca skrip pihak ketiga.
            Route::middleware('web')
                ->prefix('api')
                ->group(base_path('routes/api.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'password.changed' => EnsurePasswordChanged::class,
        ]);

        // Gerbang lisensi didaftarkan GLOBAL & PALING DEPAN (bukan alias yang
        // ditempel di grup rute) — supaya tidak ada middleware bawaan Laravel
        // (VerifyCsrfToken, Authenticate, dst.) yang bisa "mendahuluinya"
        // akibat urutan penggabungan grup/prioritas middleware. Lihat
        // EnsureLicenseActive untuk pengecualian dua path publiknya.
        $middleware->prepend(EnsureLicenseActive::class);

        // /api/license/apply dipanggil oleh tool vendor eksternal (server ke
        // server, tanpa sesi browser) — tidak akan pernah punya token CSRF.
        // Diautentikasi lewat tanda tangan HMAC di body-nya sendiri sebagai
        // gantinya (lihat LicenseController::apply).
        $middleware->validateCsrfTokens(except: ['api/license/apply']);

        // Seluruh aplikasi ini adalah API (tidak ada halaman "login" HTML di
        // sisi Laravel — login ditangani React). Tanpa ini, permintaan tak
        // terautentikasi yang tidak mengirim header Accept: application/json
        // (mis. dipanggil langsung lewat curl/browser) akan membuat middleware
        // auth bawaan mencoba redirect ke route('login') yang tidak ada,
        // sehingga malah menghasilkan 500 alih-alih 401.
        $middleware->redirectGuestsTo(fn (Request $request) => $request->is('api/*') ? null : '/login');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
