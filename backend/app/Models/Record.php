<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class Record extends Model
{
    /** Status akhir — rekaman di status ini tidak bisa diubah lagi. */
    public const FINAL_STATUSES = ['destroyed', 'archived_permanent'];

    protected $fillable = [
        'code', 'series_id', 'title', 'description', 'record_date', 'function_id', 'medium',
        'location', 'classification', 'document_id', 'status', 'active_until', 'inactive_until',
        'legal_hold', 'legal_hold_reason', 'disposed_at', 'disposal_reference', 'disposed_by', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'record_date' => 'date',
            'active_until' => 'date',
            'inactive_until' => 'date',
            'disposed_at' => 'date',
            'legal_hold' => 'boolean',
        ];
    }

    public function series(): BelongsTo
    {
        return $this->belongsTo(RecordSeries::class, 'series_id');
    }

    public function orgFunction(): BelongsTo
    {
        return $this->belongsTo(OrgFunction::class, 'function_id');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function disposer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'disposed_by');
    }

    /** @return array{active_until: string, inactive_until: string} */
    public static function retentionDates(Carbon|string $recordDate, RecordSeries $series): array
    {
        $activeUntil = Carbon::parse($recordDate)->addYears($series->retention_active_years);

        return [
            'active_until' => $activeUntil->toDateString(),
            'inactive_until' => $activeUntil->copy()->addYears($series->retention_inactive_years)->toDateString(),
        ];
    }

    /** Kode berurut sederhana (REC-00001, dst.) — rekaman jauh lebih banyak dari dokumen, jadi 5 digit. */
    public static function nextCode(): string
    {
        $last = static::orderByDesc('code')->lockForUpdate()->value('code');

        $next = 1;
        if ($last !== null && preg_match('/(\d+)$/', $last, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return 'REC-'.str_pad((string) $next, 5, '0', STR_PAD_LEFT);
    }
}
