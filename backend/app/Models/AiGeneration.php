<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiGeneration extends Model
{
    protected $fillable = ['user_id', 'kind', 'subject', 'model', 'input_tokens', 'output_tokens', 'result', 'followed_up_at', 'followed_up_ref'];

    protected function casts(): array
    {
        return ['result' => 'array', 'followed_up_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Tandai hasil AI milik pengguna ini sebagai ditindaklanjuti — diam-diam diabaikan bila bukan miliknya. */
    public static function markFollowedUp(?int $id, int $userId, string $ref): void
    {
        if (! $id) {
            return;
        }
        static::whereKey($id)->where('user_id', $userId)->whereNull('followed_up_at')
            ->update(['followed_up_at' => now(), 'followed_up_ref' => $ref]);
    }
}
