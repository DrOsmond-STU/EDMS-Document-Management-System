<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentRevision extends Model
{
    protected $fillable = [
        'legacy_id', 'document_id', 'revision_number', 'version', 'date',
        'editor_id', 'editor_name', 'notes', 'status', 'content_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'revision_number' => 'integer',
        ];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'editor_id');
    }

    public function files(): HasMany
    {
        return $this->hasMany(DocumentFile::class);
    }
}
