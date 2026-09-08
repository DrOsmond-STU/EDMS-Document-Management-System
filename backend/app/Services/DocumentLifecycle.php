<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentRelation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Dua jalur perubahan status, sengaja dipisah:
 *
 * 1. transition() — rantai maju resmi Draft → Review → Approval →
 *    Released → Obsolete, satu tahap setiap kali, ditegakkan oleh peran
 *    per tahap (lihat Permissions::STATUS_TRANSITION_ROLES).
 * 2. performAction() — tindakan pengecualian DI LUAR rantai itu: bekukan,
 *    cairkan, cabut, batalkan, tandai digantikan. Wewenangnya sama untuk
 *    semua aksi (Document Controller/sysadmin — lihat
 *    Permissions::canPerformLifecycleActions), bukan per tahap, dan wajib
 *    disertai alasan tertulis karena ini penyimpangan dari alur normal.
 *
 * Perpindahan status TIDAK membuat baris revisi baru. Revisi adalah versi
 * isi dokumen (rev 0, 1, 2, ...), sedangkan riwayat status dicatat di
 * audit_logs yang bersifat append-only — justru lebih kuat sebagai bukti
 * audit karena tidak bisa disunting belakangan.
 */
class DocumentLifecycle
{
    public const ORDER = ['draft', 'review', 'approval', 'released', 'obsolete'];

    /** @var array<string, array{from: list<string>, to: string, label: string}> */
    private const ACTIONS = [
        'freeze' => ['from' => ['released'], 'to' => 'frozen', 'label' => 'Dibekukan'],
        'unfreeze' => ['from' => ['frozen'], 'to' => 'released', 'label' => 'Dicairkan'],
        'revoke' => ['from' => ['released', 'frozen'], 'to' => 'revoked', 'label' => 'Dicabut'],
        'cancel' => ['from' => ['draft', 'review', 'approval'], 'to' => 'cancelled', 'label' => 'Dibatalkan'],
        'supersede' => ['from' => ['released'], 'to' => 'obsolete', 'label' => 'Ditandai digantikan'],
    ];

    public function __construct(private AuditLogger $audit) {}

    /** @return list<string> status berikutnya yang sah dari status sekarang (rantai maju resmi saja) */
    public function allowedNext(string $status): array
    {
        $i = array_search($status, self::ORDER, true);
        if ($i === false || $status === 'obsolete') {
            return [];
        }

        return [self::ORDER[$i + 1]];
    }

    /** @return list<string> aksi (freeze/unfreeze/revoke/cancel/supersede) yang berlaku dari status ini */
    public function availableActions(string $status): array
    {
        $actions = [];
        foreach (self::ACTIONS as $action => $config) {
            if (in_array($status, $config['from'], true)) {
                $actions[] = $action;
            }
        }

        return $actions;
    }

    public function transition(Document $document, string $to, User $actor, ?string $note = null): Document
    {
        if (! in_array($to, $this->allowedNext($document->status), true)) {
            throw new InvalidArgumentException(
                "Perpindahan dari \"{$document->status}\" ke \"{$to}\" tidak diizinkan."
            );
        }

        if ($to === 'released') {
            $this->assertReadyForRelease($document);
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

    /**
     * Bekukan/cairkan/cabut/batalkan/tandai-digantikan. $reason WAJIB dan
     * selalu tercatat di detail audit — inilah bukti tertulis kenapa
     * dokumen keluar dari alur normal.
     */
    public function performAction(Document $document, string $action, User $actor, string $reason, ?string $replacementCode = null): Document
    {
        $config = self::ACTIONS[$action] ?? null;
        if (! $config || ! in_array($document->status, $config['from'], true)) {
            throw new InvalidArgumentException(
                "Aksi \"{$action}\" tidak berlaku dari status \"{$document->status}\"."
            );
        }

        return DB::transaction(function () use ($document, $action, $config, $actor, $reason, $replacementCode) {
            $from = $document->status;
            $to = $config['to'];

            $document->status = $to;
            $document->validity = $this->validityFor($to);
            $document->save();

            $this->audit->log(
                $actor, 'lifecycle_action', 'Document', (string) $document->id, $document->code,
                "{$config['label']}: status \"{$document->title}\" berubah dari {$from} ke {$to} — alasan: {$reason}",
            );

            if ($action === 'supersede' && $replacementCode) {
                $this->linkSupersession($document, $replacementCode, $actor);
            }

            return $document;
        });
    }

    private function linkSupersession(Document $document, string $replacementCode, User $actor): void
    {
        $target = Document::where('code', $replacementCode)->first();
        if (! $target || $target->id === $document->id) {
            return;
        }

        DocumentRelation::firstOrCreate([
            'document_id' => $document->id, 'type' => 'superseded_by', 'target_document_id' => $target->id,
        ]);
        DocumentRelation::firstOrCreate([
            'document_id' => $target->id, 'type' => 'supersedes', 'target_document_id' => $document->id,
        ]);

        $this->audit->log($actor, 'update', 'Document', (string) $target->id, $target->code,
            "Ditandai sebagai pengganti {$document->code}.");
    }

    /**
     * Dokumen terkontrol WAJIB PDF sebelum dirilis — supaya watermark
     * "UNCONTROLLED COPY" bisa ditempel sungguhan ke berkas saat dilihat/
     * dicetak (lihat WatermarkService). Format Office (docx/xlsx/pptx)
     * tidak bisa diwatermark andal di hosting ini (butuh LibreOffice yang
     * tidak tersedia), jadi diblokir di sini, bukan dibiarkan lolos dengan
     * watermark yang bisa dilewati.
     */
    private function assertReadyForRelease(Document $document): void
    {
        $primary = $document->primaryFile;

        if (! $primary) {
            throw new InvalidArgumentException(
                'Dokumen belum punya berkas utama. Unggah berkas PDF terlebih dahulu sebelum merilis.'
            );
        }

        if ($primary->mime_type !== 'application/pdf') {
            throw new InvalidArgumentException(
                'Dokumen terkontrol wajib berformat PDF sebelum bisa dirilis (supaya watermark "uncontrolled copy" bisa ditempel saat dilihat/dicetak). '
                .'Konversi berkas ke PDF lalu unggah ulang sebagai berkas utama.'
            );
        }
    }

    private function validityFor(string $status): string
    {
        return match ($status) {
            'released' => 'berlaku',
            'obsolete', 'frozen', 'revoked', 'cancelled' => 'tidak_berlaku',
            default => 'belum_berlaku',
        };
    }
}
