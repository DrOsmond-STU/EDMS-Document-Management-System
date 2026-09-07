<?php

namespace App\Policies;

use App\Models\Document;
use App\Models\User;
use App\Support\Permissions;

/**
 * Gerbang hak akses dokumen. Dipanggil dari controller lewat authorize(),
 * jadi tidak ada jalur yang bisa melewatinya — berbeda dari purwarupa lama
 * yang hanya menyembunyikan tombol di frontend.
 */
class DocumentPolicy
{
    /** Dokumen yang sudah Released boleh dilihat semua pengguna aktif.
     *  Dokumen yang masih dalam proses hanya untuk yang terlibat. */
    public function view(User $user, Document $document): bool
    {
        if ($document->status === 'released') {
            return $user->hasPermission(Permissions::DOCUMENT_VIEW_RELEASED);
        }

        return $this->involvedInLifecycle($user)
            || $document->owner_id === $user->id
            || $user->function_id === $document->function_id;
    }

    public function create(User $user): bool
    {
        return $user->hasPermission(Permissions::DOCUMENT_DRAFT)
            || $user->hasPermission(Permissions::DOCUMENT_CONTROL);
    }

    public function update(User $user, Document $document): bool
    {
        // Dokumen yang sudah dirilis tidak boleh disunting diam-diam; harus
        // lewat revisi baru. Hanya Document Controller yang boleh menyentuh.
        if (in_array($document->status, ['released', 'obsolete'], true)) {
            return $user->hasPermission(Permissions::DOCUMENT_CONTROL);
        }

        return $user->hasPermission(Permissions::DOCUMENT_DRAFT)
            || $user->hasPermission(Permissions::DOCUMENT_CONTROL);
    }

    /** Mendorong dokumen ke tahap berikutnya sesuai peran per status. */
    public function transition(User $user, Document $document): bool
    {
        return Permissions::canTransitionFrom($user->roleIds(), $document->status);
    }

    public function uploadFile(User $user, Document $document): bool
    {
        return $this->update($user, $document);
    }

    public function downloadFile(User $user, Document $document): bool
    {
        return $this->view($user, $document);
    }

    public function delete(User $user, Document $document): bool
    {
        return $user->hasPermission(Permissions::DOCUMENT_CONTROL);
    }

    private function involvedInLifecycle(User $user): bool
    {
        foreach ([
            Permissions::DOCUMENT_DRAFT, Permissions::DOCUMENT_REVIEW,
            Permissions::DOCUMENT_APPROVE, Permissions::DOCUMENT_CONTROL,
            Permissions::DOCUMENT_RATIFY,
        ] as $permission) {
            if ($user->hasPermission($permission)) {
                return true;
            }
        }

        return false;
    }
}
