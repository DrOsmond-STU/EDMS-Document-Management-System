<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Satu sesi jadwal/agenda audit (kapan, proses apa, auditee & auditor). */
class AuditSession extends Model
{
    use SoftDeletes;

    protected $fillable = ['audit_id', 'starts_at', 'ends_at', 'topic', 'function_id', 'auditee', 'auditor', 'location', 'notes', 'created_by'];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    public function audit(): BelongsTo
    {
        return $this->belongsTo(Audit::class);
    }

    public function orgFunction(): BelongsTo
    {
        return $this->belongsTo(OrgFunction::class, 'function_id');
    }
}
