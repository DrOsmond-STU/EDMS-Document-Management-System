<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RecordSeries extends Model
{
    protected $table = 'record_series';

    protected $fillable = [
        'code', 'name', 'description', 'function_id', 'retention_active_years',
        'retention_inactive_years', 'disposition', 'legal_basis', 'active',
    ];

    protected function casts(): array
    {
        return [
            'retention_active_years' => 'integer',
            'retention_inactive_years' => 'integer',
            'active' => 'boolean',
        ];
    }

    public function orgFunction(): BelongsTo
    {
        return $this->belongsTo(OrgFunction::class, 'function_id');
    }

    public function records(): HasMany
    {
        return $this->hasMany(Record::class, 'series_id');
    }
}
