<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FindingAction extends Model
{
    protected $fillable = ['finding_id', 'type', 'description', 'pic', 'due_date', 'status', 'created_by'];

    protected function casts(): array
    {
        return ['due_date' => 'date'];
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
