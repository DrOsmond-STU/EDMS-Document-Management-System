<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Audit extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'code', 'type', 'audit_kind', 'external_body', 'external_reference', 'title', 'objective', 'scope', 'function_id',
        'lead_auditor_id', 'audit_team', 'planned_start', 'planned_end',
        'actual_start', 'actual_end', 'status', 'summary', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'planned_start' => 'date',
            'planned_end' => 'date',
            'actual_start' => 'date',
            'actual_end' => 'date',
        ];
    }

    public function orgFunction(): BelongsTo
    {
        return $this->belongsTo(OrgFunction::class, 'function_id');
    }

    public function leadAuditor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lead_auditor_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function standards(): BelongsToMany
    {
        return $this->belongsToMany(Standard::class, 'audit_standard', 'audit_id', 'standard_code');
    }

    public function findings(): HasMany
    {
        return $this->hasMany(Finding::class)->orderByDesc('id');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(AuditSession::class)->orderBy('starts_at');
    }

    public function checklist(): HasMany
    {
        return $this->hasMany(AuditChecklistItem::class)->orderBy('sort_order')->orderBy('id');
    }

    /** Isi audit (jadwal & checklist) hanya bisa diubah selama audit belum selesai/dibatalkan. */
    public function isLocked(): bool
    {
        return in_array($this->status, ['completed', 'cancelled'], true);
    }

    /** Kode berurut per jenis (AUD-INT-0001 / AUD-EXT-0001). */
    public static function nextCode(string $type): string
    {
        $prefix = $type === 'external' ? 'AUD-EXT-' : 'AUD-INT-';
        $last = static::withTrashed()->where('type', $type)->orderByDesc('code')->lockForUpdate()->value('code');

        $next = 1;
        if ($last !== null && preg_match('/(\d+)$/', $last, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
