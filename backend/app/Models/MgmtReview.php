<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MgmtReview extends Model
{
    protected $fillable = [
        'code', 'title', 'meeting_date', 'chair_id', 'attendees', 'status',
        'previous_actions_status', 'internal_external_changes', 'performance_summary',
        'resource_adequacy', 'risk_opportunity_effectiveness', 'improvement_opportunities',
        'decisions', 'resource_needs', 'system_changes', 'created_by',
    ];

    protected function casts(): array
    {
        return ['meeting_date' => 'date'];
    }

    public function chair(): BelongsTo
    {
        return $this->belongsTo(User::class, 'chair_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function actions(): HasMany
    {
        return $this->hasMany(MgmtReviewAction::class)->orderBy('created_at');
    }

    /** Kode berurut sederhana (MR-0001, dst.) — pola sama dengan Risk/Finding/Audit. */
    public static function nextCode(): string
    {
        $last = static::orderByDesc('code')->lockForUpdate()->value('code');

        $next = 1;
        if ($last !== null && preg_match('/(\d+)$/', $last, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return 'MR-'.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
