<?php

namespace App\Console\Commands;

use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Membuat akun dari baris perintah. Dipakai untuk akun pertama (sysadmin)
 * di instalasi baru, karena membuat pengguna lewat API butuh akun yang sudah
 * login dengan izin users.manage — ayam dan telur.
 *
 * Password tidak diminta lewat argumen agar tidak tertinggal di riwayat
 * shell; kalau tidak diberi --password, sistem membuatkan yang acak dan
 * menampilkannya sekali.
 */
class CreateUser extends Command
{
    protected $signature = 'edms:create-user
        {name : Nama lengkap}
        {email : Alamat email}
        {--roles=sysadmin : Daftar peran dipisah koma}
        {--function= : Kode fungsi/departemen, mis. it}
        {--password= : Password awal (kosongkan agar dibuat acak)}
        {--no-force-change : Jangan wajibkan ganti password saat login pertama}';

    protected $description = 'Membuat akun pengguna EDMS';

    public function handle(AuditLogger $audit): int
    {
        $email = strtolower(trim($this->argument('email')));

        if (User::where('email', $email)->exists()) {
            $this->error("Pengguna dengan email {$email} sudah ada.");

            return self::FAILURE;
        }

        $roleIds = collect(explode(',', (string) $this->option('roles')))
            ->map(fn ($r) => trim($r))->filter()->unique()->values()->all();

        $unknownRoles = array_diff($roleIds, Permissions::allRoleIds());
        if ($unknownRoles !== []) {
            $this->error('Peran tidak dikenal: '.implode(', ', $unknownRoles));
            $this->line('Peran yang tersedia: '.implode(', ', Permissions::allRoleIds()));

            return self::FAILURE;
        }

        $existingRoles = Role::whereIn('id', $roleIds)->pluck('id')->all();
        if (count($existingRoles) !== count($roleIds)) {
            $this->error('Sebagian peran belum ada di database. Jalankan: php artisan db:seed --force');

            return self::FAILURE;
        }

        $functionId = $this->option('function') ?: null;
        if ($functionId && ! OrgFunction::whereKey($functionId)->exists()) {
            $this->error("Fungsi \"{$functionId}\" tidak ada. Pilihan: ".OrgFunction::pluck('id')->join(', '));

            return self::FAILURE;
        }

        $password = $this->option('password') ?: Str::password(16, symbols: false);
        $forceChange = ! $this->option('no-force-change');

        $user = User::create([
            'name' => $this->argument('name'),
            'email' => $email,
            'password' => $password,
            'function_id' => $functionId,
            'active' => true,
            'must_change_password' => $forceChange,
            'password_changed_at' => $forceChange ? null : now(),
        ]);

        $user->roles()->sync($roleIds);

        $audit->log(null, 'create', 'User', (string) $user->id, $user->name,
            'Akun dibuat lewat baris perintah dengan peran: '.implode(', ', $roleIds));

        $this->info("Akun dibuat: {$user->name} <{$user->email}>");
        $this->line('  Peran    : '.implode(', ', $roleIds));
        $this->line('  Fungsi   : '.($functionId ?: '-'));
        $this->line('  Password : '.$password);
        if ($forceChange) {
            $this->warn('  Password ini wajib diganti saat login pertama.');
        }

        return self::SUCCESS;
    }
}
