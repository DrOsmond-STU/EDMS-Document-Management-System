<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Butir daftar periksa audit: pertanyaan per klausul, hasil, dan bukti objektif. */
class AuditChecklistItem extends Model
{
    use SoftDeletes;

    public const RESULTS = ['conform', 'nc_minor', 'nc_major', 'ofi', 'observation', 'na'];

    protected $fillable = [
        'audit_id', 'clause_ref', 'question', 'result', 'evidence', 'notes', 'sort_order',
        'finding_id', 'created_by', 'assessed_by', 'assessed_at',
    ];

    protected function casts(): array
    {
        return ['assessed_at' => 'datetime', 'sort_order' => 'integer'];
    }

    public function audit(): BelongsTo
    {
        return $this->belongsTo(Audit::class);
    }

    public function finding(): BelongsTo
    {
        return $this->belongsTo(Finding::class);
    }

    public function assessor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assessed_by');
    }
}
