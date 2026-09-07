<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentRelation extends Model
{
    protected $fillable = ['document_id', 'type', 'target_document_id'];

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'target_document_id');
    }
}
