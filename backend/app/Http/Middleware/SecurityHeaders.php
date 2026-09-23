<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

/**
 * Header keamanan untuk semua respons:
 * - nosniff, anti-clickjacking, referrer & permissions policy, isolasi opener;
 * - HSTS saat diakses lewat HTTPS;
 * - Content-Security-Policy untuk halaman aplikasi (hanya skrip/gaya/aset
 *   dari origin sendiri — menutup XSS lewat skrip pihak luar);
 * - berkas SVG unggahan disajikan dalam sandbox supaya skrip di dalamnya
 *   tidak pernah jalan di origin aplikasi.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $headers = $response->headers;

        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'SAMEORIGIN');
        $headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
        $headers->set('Cross-Origin-Opener-Policy', 'same-origin');
        $headers->remove('X-Powered-By');

        if ($request->isSecure()) {
            $headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        $type = strtolower((string) $headers->get('Content-Type'));
        if (str_contains($type, 'image/svg')) {
            $headers->set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
        } elseif (str_contains($type, 'text/html') && ! Vite::isRunningHot()) {
            $headers->set('Content-Security-Policy', implode('; ', [
                "default-src 'self'",
                "script-src 'self'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: blob:",
                "font-src 'self' data:",
                "connect-src 'self'",
                "frame-src 'self' blob:",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "frame-ancestors 'self'",
            ]));
        }

        return $response;
    }
}
