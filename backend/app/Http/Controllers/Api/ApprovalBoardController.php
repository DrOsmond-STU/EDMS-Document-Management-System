<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Services\DocumentLifecycle;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Papan Approval — ringkasan kerja: dokumen apa saja yang sedang menunggu
 * ditinjau/disetujui, dikelompokkan per tahap (Draft/Review/Approval), tanpa
 * harus membuka Register Dokumen lalu menyaring status satu-satu. Aksi
 * "Dorong" sengaja memanggil endpoint transition() yang SAMA dengan halaman
 * detail dokumen — bukan logika baru — supaya otorisasi & audit trail tetap
 * satu jalur.
 */
class ApprovalBoardController extends Controller
{
    /** Tahap yang muncul di papan — released/obsolete/dst. tidak relevan di sini. */
    private const BOARD_STATUSES = ['draft', 'review', 'approval'];

    public function __construct(private DocumentLifecycle $lifecycle) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $this->involvedInLifecycle($user)) {
            return response()->json([
                'message' => 'Papan Approval hanya untuk peran yang terlibat dalam alur dokumen (drafter, reviewer, approver, controller, ratifier, atau auditor).',
            ], 403);
        }

        $roleIds = $user->roleIds();

        $documents = Document::query()
            ->whereIn('status', self::BOARD_STATUSES)
            ->with(['orgFunction:id,name', 'owner:id,name', 'standards:code,name'])
            ->withCount('files')
            ->orderBy('updated_at')
            ->get();

        $columns = [];
        foreach (self::BOARD_STATUSES as $status) {
            $columns[$status] = [];
        }

        foreach ($documents as $document) {
            $nextStatus = $this->lifecycle->allowedNext($document->status)[0] ?? null;

            $columns[$document->status][] = [
                'id' => $document->id,
                'code' => $document->code,
                'title' => $document->title,
                'type' => $document->type,
                'classification' => $document->classification,
                'org_function' => $document->orgFunction,
                'owner' => $document->owner,
                'standards' => $document->standards,
                'files_count' => $document->files_count,
                'updated_at' => $document->updated_at,
                'days_pending' => (int) $document->updated_at->diffInDays(now()),
                'next_status' => $nextStatus,
                'can_act' => $nextStatus && Permissions::canTransitionFrom($roleIds, $document->status),
            ];
        }

        return response()->json(['columns' => $columns]);
    }

    /** Peran yang berkepentingan melihat papan ini sama sekali — sama dengan DocumentController::involvedInLifecycle. */
    private function involvedInLifecycle($user): bool
    {
        foreach ([
            Permissions::DOCUMENT_DRAFT, Permissions::DOCUMENT_REVIEW,
            Permissions::DOCUMENT_APPROVE, Permissions::DOCUMENT_CONTROL,
            Permissions::DOCUMENT_RATIFY, Permissions::AUDIT_VIEW,
        ] as $permission) {
            if ($user->hasPermission($permission)) {
                return true;
            }
        }

        return false;
    }
}
