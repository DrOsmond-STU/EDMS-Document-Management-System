<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DraftingProject extends Model
{
    use SoftDeletes;

    public const STAGE_LABELS = [
        'Permintaan', 'Undangan Rapat', 'Rapat (anggaran & foto)', 'Bukti Notulen',
        'Daftar Hadir & TTD', 'Finalisasi', 'Pengesahan', 'Masuk Register Utama',
    ];

    protected $fillable = [
        'code', 'title', 'doc_type', 'function_id', 'classification', 'reason', 'requester_id', 'drafter_id',
        'status', 'rejection_reason', 'return_note', 'final_content', 'final_file_path', 'final_file_name',
        'final_file_size', 'final_file_checksum', 'finalized_at', 'ratified_by', 'ratified_at', 'document_id',
    ];

    protected $hidden = ['final_file_path'];

    protected $appends = ['stages', 'has_final_file'];

    protected function casts(): array
    {
        return [
            'finalized_at' => 'datetime',
            'ratified_at' => 'datetime',
            'final_file_size' => 'integer',
        ];
    }

    public function orgFunction(): BelongsTo
    {
        return $this->belongsTo(OrgFunction::class, 'function_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function drafter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'drafter_id');
    }

    public function ratifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ratified_by');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function standards(): BelongsToMany
    {
        return $this->belongsToMany(Standard::class, 'drafting_project_standard', 'drafting_project_id', 'standard_code');
    }

    public function meetings(): HasMany
    {
        return $this->hasMany(DraftingMeeting::class)->orderBy('session_no');
    }

    public function getHasFinalFileAttribute(): bool
    {
        return (bool) $this->final_file_path;
    }

    /**
     * Rapat yang sudah dilaksanakan tapi buktinya belum lengkap — satu
     * sumber kebenaran untuk stepper, syarat finalisasi, dan syarat pengesahan.
     *
     * @return list<string>
     */
    public function completenessGaps(): array
    {
        $meetings = $this->relationLoaded('meetings') ? $this->meetings : $this->meetings()->with('attendees:id,drafting_meeting_id,signed_at')->get();
        $held = $meetings->whereNotNull('held_at');

        $gaps = [];
        if ($held->isEmpty()) {
            $gaps[] = 'Belum ada rapat pembahasan yang dilaksanakan.';
        }
        foreach ($held as $m) {
            if (! $m->minutes && ! $m->minutes_file_path) {
                $gaps[] = "Rapat {$m->session_no} belum punya notulen/bukti notulen.";
            }
            if ($m->attendees->whereNotNull('signed_at')->isEmpty()) {
                $gaps[] = "Rapat {$m->session_no} belum punya daftar hadir bertanda tangan.";
            }
        }

        return $gaps;
    }

    /** @return list<bool> status selesai tiap tahap (8 tahap, urut STAGE_LABELS) */
    public function getStagesAttribute(): array
    {
        $meetings = $this->relationLoaded('meetings') ? $this->meetings : collect();
        $held = $meetings->whereNotNull('held_at');
        $heldOk = $held->isNotEmpty();

        return [
            true,
            $meetings->isNotEmpty(),
            $heldOk,
            $heldOk && $held->every(fn ($m) => $m->minutes || $m->minutes_file_path),
            $heldOk && $held->every(fn ($m) => $m->relationLoaded('attendees') && $m->attendees->whereNotNull('signed_at')->isNotEmpty()),
            in_array($this->status, ['finalized', 'ratified'], true),
            $this->status === 'ratified',
            $this->document_id !== null,
        ];
    }

    /** REQ-YYYY-NNN, berurut per tahun. Dipanggil di dalam DB::transaction(). */
    public static function nextCode(): string
    {
        $prefix = 'REQ-'.now()->format('Y').'-';
        $last = static::withTrashed()->where('code', 'like', $prefix.'%')->orderByDesc('code')->lockForUpdate()->value('code');

        $next = 1;
        if ($last !== null && preg_match('/(\d+)$/', $last, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }
}
