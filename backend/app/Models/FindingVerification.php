<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FindingVerification extends Model
{
    protected $fillable = ['finding_id', 'method', 'effective', 'notes', 'created_by'];

    protected function casts(): array
    {
        return ['effective' => 'boolean'];
    }

    public function finding(): BelongsTo
    {
        return $this->belongsTo(Finding::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
