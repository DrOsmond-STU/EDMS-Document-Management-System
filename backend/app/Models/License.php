<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Baris lisensi tunggal (id=1) untuk instance ini. Ditulis HANYA lewat
 * LicenseService::apply() (dipanggil dari LicenseController::apply, yang
 * memverifikasi tanda tangan HMAC dari tool vendor eksternal) — tidak ada
 * jalur lain di aplikasi ini yang mengizinkan perubahan pada tabel ini,
 * termasuk untuk sysadmin klien sekalipun.
 */
class License extends Model
{
    protected $fillable = ['license_key', 'expires_at', 'status', 'activated_at', 'signature'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'date',
            'activated_at' => 'date',
        ];
    }

    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1], ['status' => 'inactive']);
    }
}
