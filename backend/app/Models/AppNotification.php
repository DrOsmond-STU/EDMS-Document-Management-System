<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppNotification extends Model
{
    protected $fillable = ['legacy_id', 'user_id', 'type', 'title', 'body', 'link', 'read_at'];

    protected function casts(): array
    {
        return ['read_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeUnread($query)
    {
        return $query->whereNull('read_at');
    }

    /** Notifikasi milik pengguna ini, termasuk pengumuman untuk semua orang. */
    public function scopeVisibleTo($query, int $userId)
    {
        return $query->where(fn ($q) => $q->where('user_id', $userId)->orWhereNull('user_id'));
    }
}
