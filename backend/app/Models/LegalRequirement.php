<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LegalRequirement extends Model
{
    protected $fillable = [
        'code', 'title', 'regulation_number', 'regulation_type', 'issuer', 'issued_date', 'category',
        'summary', 'applicable_clauses', 'obligations', 'function_id', 'owner', 'status',
        'compliance_status', 'last_evaluated_at', 'next_evaluation_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'issued_date' => 'date',
            'last_evaluated_at' => 'date',
            'next_evaluation_at' => 'date',
        ];
    }

    public function orgFunction(): BelongsTo
    {
        return $this->belongsTo(OrgFunction::class, 'function_id');
    }

    public function evaluations(): HasMany
    {
        return $this->hasMany(LegalEvaluation::class)->orderByDesc('evaluation_date')->orderByDesc('id');
    }

    /** Kode berurut sederhana (LEG-0001, dst.) — pola sama dengan Risk/Finding. */
    public static function nextCode(): string
    {
        $last = static::orderByDesc('code')->lockForUpdate()->value('code');

        $next = 1;
        if ($last !== null && preg_match('/(\d+)$/', $last, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return 'LEG-'.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
