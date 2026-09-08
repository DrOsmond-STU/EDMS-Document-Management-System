<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Satu baris per jenis integrasi eksternal (Integration & API). `secrets`
 * dienkripsi lewat APP_KEY (cast `encrypted:array`) — kolom mentahnya di
 * database tidak pernah berupa teks biasa, dan nilainya tidak pernah
 * dikirim balik ke frontend setelah tersimpan (lihat
 * IntegrationSettingController::payload()).
 */
class IntegrationSetting extends Model
{
    public const TYPES = ['smtp', 'ldap', 'docusign', 'google_drive'];

    protected $fillable = ['type', 'config', 'secrets', 'enabled', 'status', 'last_tested_at', 'last_test_message', 'updated_by'];

    protected function casts(): array
    {
        return [
            'config' => 'array',
            'secrets' => 'encrypted:array',
            'enabled' => 'boolean',
            'last_tested_at' => 'datetime',
        ];
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public static function forType(string $type): self
    {
        return static::firstOrCreate(['type' => $type], ['config' => [], 'secrets' => []]);
    }

    /** Nilai gabungan config (biasa) + secrets (rahasia) untuk dipakai saat mengirim/menguji. */
    public function value(string $key, mixed $default = null): mixed
    {
        return ($this->config[$key] ?? null) ?? ($this->secrets[$key] ?? $default);
    }
}
