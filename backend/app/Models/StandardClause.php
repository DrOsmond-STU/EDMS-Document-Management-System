<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StandardClause extends Model
{
    protected $fillable = ['standard_code', 'code', 'title', 'sort_order'];

    public function standard(): BelongsTo
    {
        return $this->belongsTo(Standard::class, 'standard_code');
    }

    public function assessments(): HasMany
    {
        return $this->hasMany(ClauseAssessment::class, 'clause_id');
    }
}
