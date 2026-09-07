<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Satu-satunya pintu untuk menulis jejak audit. Nama pelaku dan label entitas
 * disalin saat kejadian, bukan diambil lewat relasi saat dibaca, supaya
 * catatan tetap utuh walau akun atau dokumennya kelak berubah/dihapus.
 */
class AuditLogger
{
    public function __construct(private ?Request $request = null) {}

    public function log(
        ?User $actor,
        string $action,
        string $entity,
        ?string $entityId = null,
        ?string $entityLabel = null,
        string $detail = '',
    ): AuditLog {
        return AuditLog::create([
            'actor_id' => $actor?->id,
            'actor_name' => $actor?->name ?? 'Sistem',
            'action' => $action,
            'entity' => $entity,
            'entity_id' => $entityId,
            'entity_label' => $entityLabel,
            'detail' => $detail,
            'ip_address' => $this->request?->ip(),
            'user_agent' => substr((string) $this->request?->userAgent(), 0, 255) ?: null,
        ]);
    }
}
