<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DraftingMeeting extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'drafting_project_id', 'session_no', 'agenda', 'scheduled_at', 'location', 'held_at',
        'budget', 'minutes', 'minutes_file_path', 'minutes_file_name', 'created_by',
    ];

    protected $hidden = ['minutes_file_path'];

    protected $appends = ['has_minutes_file'];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'held_at' => 'datetime',
            'budget' => 'decimal:2',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(DraftingProject::class, 'drafting_project_id');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(DraftingMeetingPhoto::class);
    }

    public function attendees(): HasMany
    {
        return $this->hasMany(DraftingMeetingAttendee::class);
    }

    public function getHasMinutesFileAttribute(): bool
    {
        return (bool) $this->minutes_file_path;
    }
}
