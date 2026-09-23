<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LegalEvaluation extends Model
{
    protected $fillable = ['legal_requirement_id', 'compliance_status', 'evaluation_date', 'evidence', 'notes', 'evaluated_by'];

    protected function casts(): array
    {
        return ['evaluation_date' => 'date'];
    }

    public function legalRequirement(): BelongsTo
    {
        return $this->belongsTo(LegalRequirement::class);
    }

    public function evaluator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'evaluated_by');
    }
}
