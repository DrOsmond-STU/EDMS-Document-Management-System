<?php

namespace App\Console\Commands;

use App\Mail\DocumentReviewReminderMail;
use App\Models\Document;
use App\Services\IntegrationMailerFactory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/**
 * Reminder retensi/tinjauan ulang dokumen — bagian dari integrasi Email/
 * SMTP di Integration & API. Berhenti diam dengan pesan jelas kalau
 * integrasi SMTP belum diaktifkan, bukan gagal tanpa penjelasan.
 */
class SendDocumentReviewReminders extends Command
{
    protected $signature = 'documents:send-review-reminders {--days=30 : Kirim pengingat untuk dokumen yang jatuh tempo tinjauan dalam N hari ke depan}';

    protected $description = 'Kirim email pengingat ke pemilik dokumen yang tinjauan ulangnya akan jatuh tempo, lewat integrasi Email/SMTP yang aktif.';

    public function handle(IntegrationMailerFactory $mailerFactory): int
    {
        $mailerName = $mailerFactory->smtpMailerName();
        if (! $mailerName) {
            $this->warn('Integrasi Email/SMTP belum aktif atau belum lengkap (host/alamat pengirim) — tidak ada email dikirim. Aktifkan & uji dulu di halaman Integration & API.');

            return self::SUCCESS;
        }

        $days = (int) $this->option('days');

        $documents = Document::dueForReview(now()->addDays($days)->toDateString())
            ->with('owner:id,name,email')
            ->get()
            ->filter(fn (Document $doc) => $doc->owner?->email);

        if ($documents->isEmpty()) {
            $this->info("Tidak ada dokumen yang jatuh tempo tinjauan dalam {$days} hari ke depan.");

            return self::SUCCESS;
        }

        $sent = 0;
        foreach ($documents->groupBy('owner_id') as $ownerDocuments) {
            $owner = $ownerDocuments->first()->owner;

            try {
                Mail::mailer($mailerName)
                    ->to($owner->email)
                    ->send(new DocumentReviewReminderMail($owner->name, $ownerDocuments));
                $sent++;
            } catch (\Throwable $e) {
                $this->error("Gagal mengirim ke {$owner->email}: {$e->getMessage()}");
            }
        }

        $this->info("Reminder terkirim ke {$sent} pemilik dokumen ({$documents->count()} dokumen jatuh tempo).");

        return self::SUCCESS;
    }
}
