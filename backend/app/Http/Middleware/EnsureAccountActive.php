<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Status akun diperiksa di SETIAP permintaan, bukan hanya saat login —
 * akun yang dinonaktifkan/dihapus admin langsung kehilangan akses walau
 * sesinya masih hidup di browser.
 */
class EnsureAccountActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && (! $user->active || $user->deleted_at !== null)) {
            auth()->guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json(['message' => 'Akun Anda nonaktif. Hubungi administrator.'], 401);
        }

        return $next($request);
    }
}
