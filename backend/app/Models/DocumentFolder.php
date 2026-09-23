<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentFolder extends Model
{
    protected $fillable = ['name', 'parent_id', 'description', 'created_by'];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function documents(): BelongsToMany
    {
        return $this->belongsToMany(Document::class, 'document_folder_items', 'folder_id', 'document_id')
            ->withPivot(['added_by', 'created_at']);
    }

    /** True jika $candidateId adalah folder ini sendiri atau salah satu turunannya. */
    public function isSelfOrDescendant(int $candidateId): bool
    {
        $id = $candidateId;
        $guard = 0;
        while ($id !== null && $guard++ < 100) {
            if ($id === $this->id) {
                return true;
            }
            $id = self::whereKey($id)->value('parent_id');
        }

        return false;
    }
}
