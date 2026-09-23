<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Program Audit Internal & Eksternal — perencanaan, pelaksanaan, dan
 * kesimpulan audit. Satu tabel `audits` dibedakan lewat kolom `type`
 * (internal/external); temuan yang diangkat dari sebuah audit dicatat
 * lewat Register Temuan & CAPA dan ditautkan balik lewat findings.audit_id.
 * Tidak ada hapus, konsisten dengan modul lain — status `cancelled` adalah
 * cara audit "dibatalkan" tanpa menghilangkan jejaknya.
 */
class AuditController extends Controller
{
    private const TYPES = ['internal', 'external'];
    private const STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'];

    public function __construct(private AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::AUDIT_PROGRAM_VIEW)) {
            return response()->json(['message' => 'Anda tidak berwenang melihat program audit.'], 403);
        }

        $query = Audit::query()->with(['orgFunction:id,name', 'leadAuditor:id,name', 'standards:code,name', 'findings']);

        if ($type = $request->string('type')->toString()) {
            $query->where('type', $type);
        }
        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }
        if ($functionId = $request->string('function_id')->toString()) {
            $query->where('function_id', $functionId);
        }
        if ($q = trim((string) $request->string('q'))) {
            $query->where(fn ($w) => $w
                ->where('title', 'like', "%{$q}%")
                ->orWhere('code', 'like', "%{$q}%")
                ->orWhere('scope', 'like', "%{$q}%"));
        }

        $audits = $query->orderByDesc('planned_start')->orderByDesc('id')->get();

        return response()->json([
            'audits' => $audits,
            'meta' => ['types' => self::TYPES, 'statuses' => self::STATUSES],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::AUDIT_PLAN)) {
            return response()->json(['message' => 'Anda tidak berwenang menjadwalkan audit.'], 403);
        }

        $data = $this->validateAudit($request);

        $auditRecord = DB::transaction(function () use ($data, $request) {
            $record = Audit::create([
                'code' => Audit::nextCode($data['type']),
                'created_by' => $request->user()->id,
                'status' => 'planned',
                ...collect($data)->except('standards')->all(),
            ]);
            $record->standards()->sync($data['standards'] ?? []);

            return $record;
        });

        $this->audit->log($request->user(), 'create', 'Audit', $auditRecord->code, $auditRecord->title,
            "Menjadwalkan audit \"{$auditRecord->title}\" ({$auditRecord->code}).");

        return response()->json($this->present($auditRecord), 201);
    }

    public function update(Request $request, Audit $audit): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::AUDIT_PLAN)) {
            return response()->json(['message' => 'Anda tidak berwenang mengubah rencana audit.'], 403);
        }
        if ($audit->status === 'completed' || $audit->status === 'cancelled') {
            return response()->json(['message' => 'Audit yang sudah selesai/dibatalkan tidak bisa diubah.'], 422);
        }

        $data = $this->validateAudit($request, sometimes: true);
        $standards = $data['standards'] ?? null;
        unset($data['standards']);

        $audit->fill($data)->save();
        if ($standards !== null) {
            $audit->standards()->sync($standards);
        }

        $this->audit->log($request->user(), 'update', 'Audit', $audit->code, $audit->title,
            "Memperbarui rencana audit \"{$audit->title}\" ({$audit->code}).");

        return response()->json($this->present($audit->fresh()));
    }

    /** Audit selesai adalah rekaman program audit; audit yang sudah punya temuan tidak boleh hilang. */
    public function destroy(Request $request, Audit $audit): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::AUDIT_PLAN)) {
            return response()->json(['message' => 'Anda tidak berwenang menghapus rencana audit.'], 403);
        }
        if ($audit->status === 'completed') {
            return response()->json(['message' => 'Audit yang sudah selesai adalah rekaman program audit dan tidak bisa dihapus.'], 422);
        }
        $findings = $audit->findings()->count();
        if ($findings > 0) {
            return response()->json(['message' => "Audit ini sudah punya {$findings} temuan. Hapus/pindahkan temuannya dulu, atau batalkan audit."], 422);
        }

        $audit->delete();
        $this->audit->log($request->user(), 'delete', 'Audit', $audit->code, $audit->title,
            "Menghapus rencana audit \"{$audit->title}\" ({$audit->code}).");

        return response()->json(['message' => 'Audit dihapus.']);
    }

    public function transition(Request $request, Audit $audit): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::AUDIT_PLAN) && ! $request->user()->hasPermission(Permissions::AUDIT_CONDUCT)) {
            return response()->json(['message' => 'Anda tidak berwenang mengubah status audit.'], 403);
        }
        $data = $request->validate([
            'action' => ['required', 'string', Rule::in(['start', 'complete', 'cancel'])],
            'summary' => ['nullable', 'string', 'max:5000'],
        ]);

        $action = $data['action'];

        if ($action === 'cancel') {
            if (! $request->user()->hasPermission(Permissions::AUDIT_PLAN)) {
                return response()->json(['message' => 'Anda tidak berwenang membatalkan audit.'], 403);
            }
            if (! in_array($audit->status, ['planned', 'in_progress'], true)) {
                return response()->json(['message' => 'Hanya audit yang direncanakan/berjalan yang bisa dibatalkan.'], 422);
            }
            $audit->status = 'cancelled';
            $audit->save();
            $this->audit->log($request->user(), 'update', 'Audit', $audit->code, $audit->title,
                "Membatalkan audit \"{$audit->title}\" ({$audit->code}).");

            return response()->json($this->present($audit->fresh()));
        }

        if (! $request->user()->hasPermission(Permissions::AUDIT_CONDUCT)) {
            return response()->json(['message' => 'Anda tidak berwenang melaksanakan audit.'], 403);
        }

        if ($action === 'start') {
            if ($audit->status !== 'planned') {
                return response()->json(['message' => 'Hanya audit berstatus terjadwal yang bisa dimulai.'], 422);
            }
            $audit->status = 'in_progress';
            $audit->actual_start = now()->toDateString();
            $audit->save();
            $this->audit->log($request->user(), 'update', 'Audit', $audit->code, $audit->title,
                "Memulai pelaksanaan audit \"{$audit->title}\" ({$audit->code}).");
        } elseif ($action === 'complete') {
            if ($audit->status !== 'in_progress') {
                return response()->json(['message' => 'Hanya audit yang sedang berjalan yang bisa diselesaikan.'], 422);
            }
            $audit->status = 'completed';
            $audit->actual_end = now()->toDateString();
            $audit->summary = $data['summary'] ?? $audit->summary;
            $audit->save();
            $this->audit->log($request->user(), 'update', 'Audit', $audit->code, $audit->title,
                "Menyelesaikan audit \"{$audit->title}\" ({$audit->code}).");
        }

        return response()->json($this->present($audit->fresh()));
    }

    private function validateAudit(Request $request, bool $sometimes = false): array
    {
        $rule = fn (array $rules) => $sometimes ? array_merge(['sometimes'], $rules) : $rules;

        return $request->validate([
            'type' => $rule(['required', 'string', Rule::in(self::TYPES)]),
            'title' => $rule(['required', 'string', 'max:255']),
            'objective' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'scope' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'function_id' => ['sometimes', 'nullable', 'string', 'exists:org_functions,id'],
            'lead_auditor_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'audit_team' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'planned_start' => $rule(['required', 'date']),
            'planned_end' => $sometimes
                ? ['sometimes', 'required', 'date']
                : ['required', 'date', 'after_or_equal:planned_start'],
            'standards' => ['sometimes', 'array'],
            'standards.*' => ['string', 'exists:standards,code'],
        ]);
    }

    private function present(Audit $audit): Audit
    {
        return $audit->load(['orgFunction:id,name', 'leadAuditor:id,name', 'standards:code,name', 'findings']);
    }
}
