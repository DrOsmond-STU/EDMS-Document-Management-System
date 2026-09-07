<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Password bawaan dibagikan sama ke semua akun saat onboarding, sehingga
 * sebelum diganti ia bukan rahasia. Middleware ini menutup seluruh API bagi
 * akun yang belum menggantinya — kecuali endpoint untuk mengganti password
 * itu sendiri dan untuk keluar.
 */
class EnsurePasswordChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->must_change_password) {
            return response()->json([
                'message' => 'Anda wajib mengganti password bawaan sebelum memakai sistem.',
                'must_change_password' => true,
            ], 403);
        }

        return $next($request);
    }
}
