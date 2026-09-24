<?php

namespace App\Services;

use App\Models\Audit;
use App\Models\AppNotification;
use App\Models\Document;
use App\Models\DraftingProject;
use App\Models\Finding;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Support\Collection;

/**
 * Notifikasi lonceng untuk alur kerja lintas modul: siapa yang harus
 * bertindak berikutnya diberi tahu tanpa harus rajin membuka tiap register.
 * Penerima selalu disaring dengan hak akses yang sama seperti halaman
 * tujuannya (peran + klasifikasi dokumen), jadi notifikasi tidak pernah
 * membocorkan judul dokumen/temuan kepada orang yang tidak berhak melihatnya.
 */
class WorkflowNotifier
{
    /** Dokumen masuk tahap baru pada rantai Draft → Review → Approval → Released. */
    public function documentTransitioned(Document $document, string $to, User $actor): void
    {
        $label = "{$document->code} — {$document->title}";
        $link = "/documents/{$document->id}";

        match ($to) {
            'review' => $this->send($this->withPermission(Permissions::DOCUMENT_REVIEW)->filter(fn (User $u) => $u->can('view', $document)),
                'document_review', "Dokumen menunggu review Anda: {$document->code}", $label, $link, $actor),
            'approval' => $this->send($this->withPermission(Permissions::DOCUMENT_APPROVE)->filter(fn (User $u) => $u->can('view', $document)),
                'document_approval', "Dokumen menunggu persetujuan Anda: {$document->code}", $label, $link, $actor),
            'released' => $this->send($this->byIds([$document->owner_id, $document->created_by]),
                'document_released', "Dokumen telah terbit: {$document->code}", $label, $link, $actor),
            default => null,
        };
    }

    public function draftingAssigned(DraftingProject $project, User $drafter, User $actor): void
    {
        $this->send(collect([$drafter]), 'drafting_assigned', "Anda ditugaskan menyusun {$project->code}", $project->title, "/drafting/{$project->id}", $actor);
        $this->send($this->byIds([$project->requester_id]), 'drafting_in_progress', "Permintaan {$project->code} mulai disusun oleh {$drafter->name}", $project->title, "/drafting/{$project->id}", $actor);
    }

    public function draftingFinalized(DraftingProject $project, User $actor): void
    {
        $this->send($this->withPermission(Permissions::DOCUMENT_RATIFY), 'drafting_finalized',
            "Draf final menunggu pengesahan: {$project->code}", $project->title, "/drafting/{$project->id}", $actor);
    }

    public function draftingDecided(DraftingProject $project, string $outcome, User $actor, ?string $note = null): void
    {
        [$type, $title, $to] = match ($outcome) {
            'ratified' => ['drafting_ratified', "Dokumen {$project->code} telah disahkan", [$project->requester_id, $project->drafter_id]],
            'returned' => ['drafting_returned', "Draf {$project->code} dikembalikan untuk diperbaiki", [$project->drafter_id]],
            'rejected' => ['drafting_rejected', "Permintaan {$project->code} ditolak", [$project->requester_id]],
        };
        $this->send($this->byIds($to), $type, $title, $note ? mb_strimwidth($note, 0, 160, '…') : $project->title, "/drafting/{$project->id}", $actor);
    }

    /** Temuan baru: kepala fungsi yang bertanggung jawab perlu menyusun analisis akar masalah & CAPA. */
    public function findingRaised(Finding $finding, User $actor): void
    {
        $this->send($this->functionHeads($finding->function_id), 'finding_raised',
            "Temuan baru untuk fungsi Anda: {$finding->code}", $finding->title, '/findings?q='.urlencode($finding->code), $actor);
    }

    public function auditScheduled(Audit $audit, User $actor): void
    {
        $path = $audit->type === 'external' ? '/audit-external' : '/audit-internal';
        $this->send($this->functionHeads($audit->function_id), 'audit_scheduled',
            "Fungsi Anda dijadwalkan audit: {$audit->code}", "{$audit->title} ({$audit->planned_start?->format('d/m/Y')})", $path, $actor);
    }

    /** @return Collection<int, User> */
    private function withPermission(string $permission): Collection
    {
        return User::where('active', true)->with('roles:id')->get()->filter(fn (User $u) => $u->hasPermission($permission))->values();
    }

    /** @return Collection<int, User> */
    private function functionHeads(?string $functionId): Collection
    {
        if (! $functionId) {
            return collect();
        }

        return User::where('active', true)->where('function_id', $functionId)
            ->whereHas('roles', fn ($q) => $q->where('roles.id', 'function_head'))->with('roles:id')->get();
    }

    /** @return Collection<int, User> */
    private function byIds(array $ids): Collection
    {
        $ids = array_values(array_unique(array_filter($ids)));

        return $ids ? User::whereIn('id', $ids)->where('active', true)->with('roles:id')->get() : collect();
    }

    private function send(Collection $users, string $type, string $title, string $body, string $link, User $actor): void
    {
        foreach ($users->unique('id') as $user) {
            if ($user->id === $actor->id) {
                continue; // tidak perlu memberi tahu diri sendiri
            }
            AppNotification::create([
                'user_id' => $user->id, 'type' => $type, 'title' => mb_strimwidth($title, 0, 250, '…'),
                'body' => mb_strimwidth($body, 0, 250, '…'), 'link' => $link,
            ]);
        }
    }
}
