<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Status akun diperiksa di SETIAP permintaan, bukan hanya saat login —
 * akun yang dinonaktifkan/dihapus admin langsung kehilangan akses walau
 * sesinya masih hidup di browser. Begitu juga sesi yang dibuat sebelum
 * password diganti/di-reset (User::sessions_valid_after).
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

        // Password diganti/di-reset setelah sesi ini dibuat → sesi ini tidak lagi tepercaya.
        $authAt = $request->hasSession() ? $request->session()->get('auth_at') : null;
        if ($user && $user->sessions_valid_after && (! $authAt || $authAt < $user->sessions_valid_after->getTimestamp())) {
            auth()->guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json(['message' => 'Sesi Anda berakhir karena password akun diubah. Silakan login kembali.'], 401);
        }

        return $next($request);
    }
}
