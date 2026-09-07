<?php

namespace App\Models;

use App\Support\Permissions;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable([
    'legacy_id', 'name', 'email', 'password', 'function_id', 'active',
    'must_change_password', 'password_changed_at', 'last_login_at',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'active' => 'boolean',
            'must_change_password' => 'boolean',
            'password_changed_at' => 'datetime',
            'last_login_at' => 'datetime',
            'locked_until' => 'datetime',
        ];
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    public function orgFunction(): BelongsTo
    {
        return $this->belongsTo(OrgFunction::class, 'function_id');
    }

    public function ownedDocuments(): HasMany
    {
        return $this->hasMany(Document::class, 'owner_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(AppNotification::class);
    }

    /** @return list<string> */
    public function roleIds(): array
    {
        return $this->roles->pluck('id')->all();
    }

    /**
     * Otoritas tunggal "boleh atau tidak" di sisi server. Pemeriksaan yang
     * sama dipakai Policy, jadi tidak ada jalur yang melewatinya.
     */
    public function hasPermission(string $permission): bool
    {
        return Permissions::rolesHave($this->roleIds(), $permission);
    }

    public function hasRole(string $roleId): bool
    {
        return in_array($roleId, $this->roleIds(), true);
    }

    /** Akun terkunci sementara karena gagal login berkali-kali. */
    public function isLocked(): bool
    {
        return $this->locked_until !== null && $this->locked_until->isFuture();
    }

    /** Boleh memakai sistem: aktif dan tidak sedang terkunci. */
    public function canSignIn(): bool
    {
        return $this->active && ! $this->isLocked();
    }
}
