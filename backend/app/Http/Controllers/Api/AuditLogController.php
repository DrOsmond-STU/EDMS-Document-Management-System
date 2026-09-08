<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Hanya baca — audit_logs bersifat append-only (lihat App\Models\AuditLog),
 * jadi controller ini sengaja tidak punya store/update/destroy sama sekali.
 */
class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }

        $query = AuditLog::query()->with('actor:id,name')->orderByDesc('created_at');

        foreach (['entity', 'action'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->string($filter));
            }
        }

        if ($request->filled('actor')) {
            $query->where('actor_name', 'like', '%'.$request->string('actor').'%');
        }

        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(fn ($q) => $q->where('detail', 'like', $term)
                ->orWhere('entity_label', 'like', $term)
                ->orWhere('entity_id', 'like', $term));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->string('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->string('date_to'));
        }

        return response()->json(
            $query->paginate((int) $request->integer('per_page', 25))
        );
    }

    /** Nilai unik untuk dropdown filter — dihitung dari data yang benar-benar ada, bukan daftar statis. */
    public function meta(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }

        return response()->json([
            'entities' => AuditLog::query()->select('entity')->distinct()->orderBy('entity')->pluck('entity'),
            'actions' => AuditLog::query()->select('action')->distinct()->orderBy('action')->pluck('action'),
        ]);
    }

    private function authorized(Request $request): bool
    {
        return $request->user()->hasPermission(Permissions::AUDIT_VIEW);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['message' => 'Anda tidak berwenang melihat jejak audit.'], 403);
    }
}
