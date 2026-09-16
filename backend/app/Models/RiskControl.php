<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiskControl extends Model
{
    protected $fillable = ['risk_id', 'description', 'created_by'];

    public function risk(): BelongsTo
    {
        return $this->belongsTo(Risk::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
