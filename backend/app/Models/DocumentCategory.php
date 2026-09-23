<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class DocumentCategory extends Model
{
    protected $fillable = ['name', 'color'];

    public function documents(): BelongsToMany
    {
        return $this->belongsToMany(Document::class, 'document_category', 'category_id', 'document_id');
    }
}
