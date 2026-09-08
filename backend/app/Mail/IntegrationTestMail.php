<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/** Email uji untuk tombol "Uji Koneksi" di halaman Integration & API. */
class IntegrationTestMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(private string $fromAddress, private string $fromName) {}

    public function build(): self
    {
        return $this->from($this->fromAddress, $this->fromName)
            ->subject('Uji Koneksi SMTP — EDMS')
            ->view('emails.integration-test', ['sentAt' => now()->translatedFormat('d F Y H:i')]);
    }
}
