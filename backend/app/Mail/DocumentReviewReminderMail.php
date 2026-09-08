<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Collection;

class DocumentReviewReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    /** @param Collection $documents */
    public function __construct(public string $ownerName, public Collection $documents) {}

    public function build(): self
    {
        $count = $this->documents->count();

        return $this->subject("Pengingat: {$count} dokumen perlu ditinjau ulang")
            ->view('emails.document-review-reminder');
    }
}
