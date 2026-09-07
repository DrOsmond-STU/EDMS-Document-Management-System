<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    /** Gagal berturut-turut sebelum akun dikunci sementara. */
    private const MAX_FAILED_ATTEMPTS = 5;

    private const LOCK_MINUTES = 15;

    public function __construct(private AuditLogger $audit) {}

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', strtolower(trim($data['email'])))->first();

        // Pesan gagal sengaja dibuat sama untuk email tidak dikenal maupun
        // password salah, agar tidak bisa dipakai menebak akun mana yang ada.
        $generic = ['message' => 'Email atau password salah.'];

        if (! $user) {
            $this->audit->log(null, 'login_failed', 'Session', null, $data['email'], 'Percobaan login dengan email tidak dikenal');

            return response()->json($generic, 401);
        }

        if ($user->isLocked()) {
            return response()->json([
                'message' => 'Akun dikunci sementara karena terlalu banyak percobaan gagal. Coba lagi nanti.',
                'locked_until' => $user->locked_until,
            ], 423);
        }

        if (! Hash::check($data['password'], $user->password)) {
            $user->increment('failed_login_count');

            if ($user->failed_login_count >= self::MAX_FAILED_ATTEMPTS) {
                $user->forceFill([
                    'locked_until' => now()->addMinutes(self::LOCK_MINUTES),
                    'failed_login_count' => 0,
                ])->save();

                $this->audit->log($user, 'account_locked', 'User', (string) $user->id, $user->name,
                    'Akun dikunci '.self::LOCK_MINUTES.' menit setelah '.self::MAX_FAILED_ATTEMPTS.' percobaan gagal');
            } else {
                $this->audit->log($user, 'login_failed', 'Session', (string) $user->id, $user->name, 'Password salah');
            }

            return response()->json($generic, 401);
        }

        if (! $user->active) {
            $this->audit->log($user, 'login_failed', 'Session', (string) $user->id, $user->name, 'Akun nonaktif');

            return response()->json(['message' => 'Akun Anda nonaktif. Hubungi administrator.'], 403);
        }

        $request->session()->regenerate();
        auth()->login($user, remember: false);

        $user->forceFill([
            'failed_login_count' => 0,
            'locked_until' => null,
            'last_login_at' => now(),
        ])->save();

        $this->audit->log($user, 'login', 'Session', (string) $user->id, $user->name, 'Login berhasil');

        return response()->json($this->profile($user));
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user) {
            $this->audit->log($user, 'logout', 'Session', (string) $user->id, $user->name, 'Keluar dari sistem');
        }

        auth()->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Berhasil keluar.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->profile($request->user()));
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            return response()->json(['message' => 'Password Anda saat ini salah.'], 422);
        }

        if (Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Password baru harus berbeda dari password lama.'], 422);
        }

        $user->forceFill([
            'password' => $data['password'],
            'must_change_password' => false,
            'password_changed_at' => now(),
        ])->save();

        // Sesi lain milik pengguna ini dianggap tidak lagi tepercaya.
        auth()->logoutOtherDevices($data['password']);

        $this->audit->log($user, 'password_change', 'User', (string) $user->id, $user->name, 'Mengganti password sendiri');

        return response()->json($this->profile($user->fresh()));
    }

    private function profile(User $user): array
    {
        $user->loadMissing(['roles', 'orgFunction']);
        $roleIds = $user->roleIds();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'function_id' => $user->function_id,
            'function_name' => $user->orgFunction?->name,
            'roles' => $roleIds,
            'permissions' => Permissions::forRoles($roleIds),
            'must_change_password' => $user->must_change_password,
            'last_login_at' => $user->last_login_at,
        ];
    }
}
