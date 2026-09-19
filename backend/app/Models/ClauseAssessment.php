<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClauseAssessment extends Model
{
    protected $fillable = ['clause_id', 'document_id', 'status', 'note', 'assessed_by', 'assessed_at'];

    protected function casts(): array
    {
        return ['assessed_at' => 'datetime'];
    }

    public function clause(): BelongsTo
    {
        return $this->belongsTo(StandardClause::class, 'clause_id');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function assessor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assessed_by');
    }
}
