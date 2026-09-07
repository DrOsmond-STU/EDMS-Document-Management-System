<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use RuntimeException;

/**
 * Jejak audit — hanya boleh ditambah, tidak boleh diubah atau dihapus.
 * Aturan itu ditegakkan di sini (bukan sekadar konvensi) supaya kode mana pun
 * yang keliru mencoba mengubah catatan audit akan gagal keras, bukan diam-diam
 * merusak bukti.
 */
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'actor_id', 'actor_name', 'action', 'entity', 'entity_id',
        'entity_label', 'detail', 'ip_address', 'user_agent',
    ];

    protected static function booted(): void
    {
        static::updating(function () {
            throw new RuntimeException('Catatan audit tidak boleh diubah.');
        });

        static::deleting(function () {
            throw new RuntimeException('Catatan audit tidak boleh dihapus.');
        });
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
