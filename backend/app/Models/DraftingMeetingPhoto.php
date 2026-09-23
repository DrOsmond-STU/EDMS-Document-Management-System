<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DraftingMeetingPhoto extends Model
{
    protected $fillable = ['drafting_meeting_id', 'path', 'original_name', 'mime_type', 'caption'];

    protected $hidden = ['path'];

    public function meeting(): BelongsTo
    {
        return $this->belongsTo(DraftingMeeting::class, 'drafting_meeting_id');
    }
}
