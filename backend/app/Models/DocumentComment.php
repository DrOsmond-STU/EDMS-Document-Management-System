<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class DocumentComment extends Model
{
    use SoftDeletes;

    protected $fillable = ['document_id', 'parent_id', 'user_id', 'section', 'body', 'resolved_at', 'resolved_by', 'edited_at'];

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime', 'edited_at' => 'datetime'];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->withTrashed()->orderBy('created_at');
    }

    public function mentions(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'document_comment_mentions', 'comment_id', 'user_id');
    }

    /** Isi komentar yang dihapus tidak pernah dikirim ke klien — hanya penanda bahwa ia pernah ada. */
    public function toArray(): array
    {
        $data = parent::toArray();
        if ($this->trashed()) {
            $data['body'] = null;
            $data['section'] = null;
            $data['mentions'] = [];
        }
        $data['is_deleted'] = $this->trashed();

        return $data;
    }
}
