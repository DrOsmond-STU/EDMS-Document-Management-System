<?php

namespace App\Services;

use App\Models\Document;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Alur status dokumen: Draft → Review → Approval → Released → Obsolete.
 * Hanya boleh maju satu tahap.
 *
 * Perpindahan status TIDAK membuat baris revisi baru. Revisi adalah versi
 * isi dokumen (rev 0, 1, 2, ...), sedangkan riwayat status dicatat di
 * audit_logs yang bersifat append-only — justru lebih kuat sebagai bukti
 * audit karena tidak bisa disunting belakangan.
 */
class DocumentLifecycle
{
    public const ORDER = ['draft', 'review', 'approval', 'released', 'obsolete'];

    public function __construct(private AuditLogger $audit) {}

    /** @return list<string> status berikutnya yang sah dari status sekarang */
    public function allowedNext(string $status): array
    {
        $i = array_search($status, self::ORDER, true);
        if ($i === false || $status === 'obsolete') {
            return [];
        }

        return [self::ORDER[$i + 1]];
    }

    public function transition(Document $document, string $to, User $actor, ?string $note = null): Document
    {
        if (! in_array($to, $this->allowedNext($document->status), true)) {
            throw new InvalidArgumentException(
                "Perpindahan dari \"{$document->status}\" ke \"{$to}\" tidak diizinkan."
            );
        }

        return DB::transaction(function () use ($document, $to, $actor, $note) {
            $from = $document->status;

            $document->status = $to;
            $document->validity = $this->validityFor($to);

            if ($to === 'released') {
                $document->effective_date ??= now()->toDateString();
                // Dokumen wajib ditinjau ulang setahun setelah berlaku.
                $document->review_date ??= now()->addYear()->toDateString();
            }

            $document->save();

            $this->audit->log(
                $actor, 'status_change', 'Document', (string) $document->id, $document->code,
                "Status \"{$document->title}\" berubah dari {$from} ke {$to}".($note ? " — {$note}" : ''),
            );

            return $document;
        });
    }

    private function validityFor(string $status): string
    {
        return match ($status) {
            'released' => 'berlaku',
            'obsolete' => 'tidak_berlaku',
            default => 'belum_berlaku',
        };
    }
}
