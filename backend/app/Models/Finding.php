<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Finding extends Model
{
    protected $fillable = [
        'code', 'type', 'status', 'audit_source', 'audit_reference', 'clause_reference',
        'title', 'description', 'evidence', 'function_id', 'owner', 'raised_by', 'due_date',
        'root_cause', 'rejection_reason', 'created_by',
    ];

    protected function casts(): array
    {
        return ['due_date' => 'date'];
    }

    public function orgFunction(): BelongsTo
    {
        return $this->belongsTo(OrgFunction::class, 'function_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function standards(): BelongsToMany
    {
        return $this->belongsToMany(Standard::class, 'finding_standard', 'finding_id', 'standard_code');
    }

    public function actions(): HasMany
    {
        return $this->hasMany(FindingAction::class)->orderBy('created_at');
    }

    public function verifications(): HasMany
    {
        return $this->hasMany(FindingVerification::class)->orderBy('created_at');
    }

    /** Kode berurut sederhana (FIND-0001, dst.) — pola sama dengan Risk::nextCode(). */
    public static function nextCode(): string
    {
        $last = static::orderByDesc('code')->lockForUpdate()->value('code');

        $next = 1;
        if ($last !== null && preg_match('/(\d+)$/', $last, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return 'FIND-'.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }

    public function isOverdue(): bool
    {
        return $this->due_date !== null
            && $this->due_date->isPast()
            && ! in_array($this->status, ['closed', 'rejected'], true);
    }
}
