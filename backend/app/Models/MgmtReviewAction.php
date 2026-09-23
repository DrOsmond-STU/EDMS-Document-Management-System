<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MgmtReviewAction extends Model
{
    protected $fillable = ['mgmt_review_id', 'description', 'pic', 'due_date', 'status', 'created_by'];

    protected function casts(): array
    {
        return ['due_date' => 'date'];
    }

    public function mgmtReview(): BelongsTo
    {
        return $this->belongsTo(MgmtReview::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
