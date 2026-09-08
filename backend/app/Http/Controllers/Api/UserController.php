<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Manajemen Pengguna & Hak Akses — CRUD akun dan penetapan peran, khusus
 * users.manage (sysadmin). Tidak ada hapus akun sungguhan: dokumen yang
 * dimiliki/dibuat/diaudit seorang pengguna harus tetap bisa ditelusuri
 * (owner_id/created_by nullOnDelete di database tidak berarti kita boleh
 * menghilangkan jejaknya begitu saja) — akses dicabut lewat nonaktifkan.
 * Tidak ada pengiriman email (MAIL_MAILER=log di hosting ini): password
 * awal/reset ditampilkan SEKALI di respons untuk disampaikan admin secara
 * manual, lalu wajib diganti pengguna sendiri di login pertama
 * (must_change_password, sudah ada dari alur login).
 */
class UserController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }

        $query = User::query()->with(['roles:id,label', 'orgFunction:id,name']);

        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(fn ($q) => $q->where('name', 'like', $term)->orWhere('email', 'like', $term));
        }

        if ($request->filled('role')) {
            $role = $request->string('role');
            $query->whereHas('roles', fn ($q) => $q->where('roles.id', $role));
        }

        if ($request->filled('active')) {
            $query->where('active', $request->boolean('active'));
        }

        return response()->json(
            $query->orderBy('name')->paginate((int) $request->integer('per_page', 25))
        );
    }

    /** Data acuan untuk form buat/ubah pengguna. */
    public function meta(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }

        return response()->json([
            'roles' => Role::query()->orderBy('sort_order')->get(['id', 'label', 'summary']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }

        $data = $this->validateUser($request, isCreate: true);
        $tempPassword = Str::password(12);

        $user = User::create([
            'name' => $data['name'],
            'email' => strtolower($data['email']),
            'function_id' => $data['function_id'] ?? null,
            'active' => $data['active'] ?? true,
            'password' => $tempPassword,
            'must_change_password' => true,
        ]);

        $user->roles()->sync($data['roles']);

        $this->audit->log($request->user(), 'create', 'User', (string) $user->id, $user->name,
            "Membuat akun \"{$user->name}\" ({$user->email}) dengan peran: ".implode(', ', $data['roles']));

        return response()->json([
            'user' => $user->fresh()->load(['roles:id,label', 'orgFunction:id,name']),
            // Hanya muncul SEKALI di respons ini — tidak disimpan/ditampilkan lagi setelahnya.
            'temporary_password' => $tempPassword,
        ], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }

        $data = $this->validateUser($request, isCreate: false, userId: $user->id);
        $actor = $request->user();
        $isSelf = $actor->id === $user->id;

        if ($isSelf && array_key_exists('active', $data) && ! $data['active']) {
            throw ValidationException::withMessages([
                'active' => 'Anda tidak bisa menonaktifkan akun Anda sendiri.',
            ]);
        }

        // Jangan sampai admin sendiri tidak sengaja mencabut wewenangnya
        // sendiri mengelola pengguna — bisa mengunci semua orang keluar
        // dari halaman ini tanpa jalan balik selain lewat database langsung.
        if ($isSelf && array_key_exists('roles', $data)
            && $actor->hasPermission(Permissions::USERS_MANAGE)
            && ! Permissions::rolesHave($data['roles'], Permissions::USERS_MANAGE)) {
            throw ValidationException::withMessages([
                'roles' => 'Anda tidak bisa mencabut peran yang memberi wewenang mengelola pengguna dari akun Anda sendiri.',
            ]);
        }

        $changed = [];
        foreach (['name', 'email', 'function_id', 'active'] as $field) {
            if (array_key_exists($field, $data)) {
                $value = $field === 'email' ? strtolower($data[$field]) : $data[$field];
                if ($user->{$field} != $value) {
                    $changed[] = $field;
                }
                $user->{$field} = $value;
            }
        }
        $user->save();

        if (array_key_exists('roles', $data)) {
            $user->roles()->sync($data['roles']);
            $changed[] = 'roles';
        }

        if ($changed) {
            $this->audit->log($actor, 'update', 'User', (string) $user->id, $user->name,
                "Memperbarui akun \"{$user->name}\": ".implode(', ', $changed)
                .(in_array('roles', $changed, true) ? ' → peran: '.implode(', ', $data['roles']) : ''));
        }

        return response()->json($user->fresh()->load(['roles:id,label', 'orgFunction:id,name']));
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }

        $tempPassword = Str::password(12);

        $user->forceFill([
            'password' => $tempPassword,
            'must_change_password' => true,
            'failed_login_count' => 0,
            'locked_until' => null,
        ])->save();

        $this->audit->log($request->user(), 'password_reset', 'User', (string) $user->id, $user->name,
            "Mengatur ulang password akun \"{$user->name}\" — pengguna wajib menggantinya di login berikutnya.");

        return response()->json([
            'message' => 'Password baru dibuat. Sampaikan ke pengguna secara langsung — tidak akan ditampilkan lagi.',
            'temporary_password' => $tempPassword,
        ]);
    }

    private function validateUser(Request $request, bool $isCreate, ?int $userId = null): array
    {
        $emailRule = Rule::unique('users', 'email');
        if ($userId) {
            $emailRule->ignore($userId);
        }

        $rules = [
            'name' => [$isCreate ? 'required' : 'sometimes', 'string', 'max:255'],
            'email' => [$isCreate ? 'required' : 'sometimes', 'email', 'max:255', $emailRule],
            'function_id' => ['sometimes', 'nullable', 'exists:org_functions,id'],
            'active' => ['sometimes', 'boolean'],
            'roles' => [$isCreate ? 'required' : 'sometimes', 'array', 'min:1'],
            'roles.*' => ['string', 'exists:roles,id'],
        ];

        return $request->validate($rules);
    }

    private function authorized(Request $request): bool
    {
        return $request->user()->hasPermission(Permissions::USERS_MANAGE);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['message' => 'Anda tidak berwenang mengelola pengguna.'], 403);
    }
}
