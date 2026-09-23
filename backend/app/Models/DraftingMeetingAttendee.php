<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DraftingMeetingAttendee extends Model
{
    use SoftDeletes;

    protected $fillable = ['drafting_meeting_id', 'name', 'position', 'signature', 'signed_at'];

    // Gambar TTD bisa puluhan KB — tidak ikut di JSON daftar; diambil lewat endpoint gambar tersendiri.
    protected $hidden = ['signature'];

    protected function casts(): array
    {
        return ['signed_at' => 'datetime'];
    }

    public function meeting(): BelongsTo
    {
        return $this->belongsTo(DraftingMeeting::class, 'drafting_meeting_id');
    }
}
