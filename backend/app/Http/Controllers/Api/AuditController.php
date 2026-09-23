<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Models\AuditChecklistItem;
use App\Models\AuditSession;
use App\Models\Finding;
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
 * Isi audit — jadwal/agenda (AuditSession) dan daftar periksa
 * (AuditChecklistItem) — punya CRUD sendiri di bawah; keduanya terkunci
 * begitu audit selesai/dibatalkan supaya catatan audit tetap utuh.
 */
class AuditController extends Controller
{
    private const TYPES = ['internal', 'external'];
    private const STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'];
    private const KINDS = [
        'internal' => ['system', 'process', 'product', 'follow_up'],
        'external' => ['certification', 'surveillance', 'recertification', 'customer', 'regulator', 'supplier'],
    ];

    public function __construct(private AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::AUDIT_PROGRAM_VIEW)) {
            return response()->json(['message' => 'Anda tidak berwenang melihat program audit.'], 403);
        }

        $query = Audit::query()->with(self::RELATIONS);

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
            'meta' => ['types' => self::TYPES, 'statuses' => self::STATUSES, 'kinds' => self::KINDS, 'results' => AuditChecklistItem::RESULTS],
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

        DB::transaction(function () use ($audit) {
            $audit->sessions()->delete();
            $audit->checklist()->delete();
            $audit->delete();
        });
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
            'audit_kind' => ['sometimes', 'nullable', 'string', Rule::in(array_merge(...array_values(self::KINDS)))],
            'external_body' => ['sometimes', 'nullable', 'string', 'max:255'],
            'external_reference' => ['sometimes', 'nullable', 'string', 'max:255'],
            'planned_start' => $rule(['required', 'date']),
            'planned_end' => $sometimes
                ? ['sometimes', 'required', 'date']
                : ['required', 'date', 'after_or_equal:planned_start'],
            'standards' => ['sometimes', 'array'],
            'standards.*' => ['string', 'exists:standards,code'],
        ]);
    }

    // ---- Jadwal / agenda audit ---------------------------------------

    public function storeSession(Request $request, Audit $audit): JsonResponse
    {
        if ($denied = $this->guardContent($request, $audit)) {
            return $denied;
        }
        $session = $audit->sessions()->create([...$this->validateSession($request), 'created_by' => $request->user()->id]);
        $this->audit->log($request->user(), 'update', 'Audit', $audit->code, $audit->title,
            "Menambah jadwal audit \"{$session->topic}\" ({$audit->code}).");

        return response()->json($this->present($audit->fresh()), 201);
    }

    public function updateSession(Request $request, Audit $audit, AuditSession $session): JsonResponse
    {
        abort_unless($session->audit_id === $audit->id, 404);
        if ($denied = $this->guardContent($request, $audit)) {
            return $denied;
        }
        $session->update($this->validateSession($request, sometimes: true));
        $this->audit->log($request->user(), 'update', 'Audit', $audit->code, $audit->title,
            "Mengubah jadwal audit \"{$session->topic}\" ({$audit->code}).");

        return response()->json($this->present($audit->fresh()));
    }

    public function destroySession(Request $request, Audit $audit, AuditSession $session): JsonResponse
    {
        abort_unless($session->audit_id === $audit->id, 404);
        if ($denied = $this->guardContent($request, $audit)) {
            return $denied;
        }
        $session->delete();
        $this->audit->log($request->user(), 'delete', 'Audit', $audit->code, $audit->title,
            "Menghapus jadwal audit \"{$session->topic}\" ({$audit->code}).");

        return response()->json($this->present($audit->fresh()));
    }

    // ---- Daftar periksa (checklist) ----------------------------------

    public function storeChecklist(Request $request, Audit $audit): JsonResponse
    {
        if ($denied = $this->guardContent($request, $audit)) {
            return $denied;
        }
        $data = $this->validateChecklist($request);
        $item = $audit->checklist()->create([
            ...$data,
            'sort_order' => (int) $audit->checklist()->withTrashed()->max('sort_order') + 1,
            'created_by' => $request->user()->id,
            ...(isset($data['result']) ? ['assessed_by' => $request->user()->id, 'assessed_at' => now()] : []),
        ]);
        $this->audit->log($request->user(), 'update', 'Audit', $audit->code, $audit->title,
            "Menambah butir checklist audit ({$audit->code}): ".mb_substr($item->question, 0, 120));

        return response()->json($this->present($audit->fresh()), 201);
    }

    public function updateChecklist(Request $request, Audit $audit, AuditChecklistItem $item): JsonResponse
    {
        abort_unless($item->audit_id === $audit->id, 404);
        if ($denied = $this->guardContent($request, $audit)) {
            return $denied;
        }
        $data = $this->validateChecklist($request, sometimes: true);
        if (array_key_exists('result', $data) && $data['result'] !== $item->result) {
            $data['assessed_by'] = $data['result'] ? $request->user()->id : null;
            $data['assessed_at'] = $data['result'] ? now() : null;
        }
        $item->update($data);
        $this->audit->log($request->user(), 'update', 'Audit', $audit->code, $audit->title,
            "Mengubah butir checklist audit ({$audit->code}): ".mb_substr($item->question, 0, 120));

        return response()->json($this->present($audit->fresh()));
    }

    public function destroyChecklist(Request $request, Audit $audit, AuditChecklistItem $item): JsonResponse
    {
        abort_unless($item->audit_id === $audit->id, 404);
        if ($denied = $this->guardContent($request, $audit)) {
            return $denied;
        }
        if ($item->finding_id) {
            return response()->json(['message' => 'Butir ini sudah menjadi temuan — hapus/tolak temuannya dulu di Register Temuan & CAPA.'], 422);
        }
        $item->delete();
        $this->audit->log($request->user(), 'delete', 'Audit', $audit->code, $audit->title,
            "Menghapus butir checklist audit ({$audit->code}): ".mb_substr($item->question, 0, 120));

        return response()->json($this->present($audit->fresh()));
    }

    /** Angkat butir checklist ber-hasil NC/OFI/observasi menjadi temuan di Register Temuan & CAPA. */
    public function raiseFinding(Request $request, Audit $audit, AuditChecklistItem $item): JsonResponse
    {
        abort_unless($item->audit_id === $audit->id, 404);
        $user = $request->user();
        if (! $user->hasPermission(Permissions::FINDING_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang membuat temuan.'], 403);
        }
        if (! in_array($item->result, ['nc_minor', 'nc_major', 'ofi', 'observation'], true)) {
            return response()->json(['message' => 'Hanya butir dengan hasil NC, OFI, atau observasi yang bisa dijadikan temuan.'], 422);
        }
        if ($item->finding_id) {
            return response()->json(['message' => 'Butir ini sudah menjadi temuan.'], 422);
        }

        $finding = DB::transaction(function () use ($audit, $item, $user) {
            $finding = Finding::create([
                'code' => Finding::nextCode(),
                'status' => 'open',
                'type' => $item->result,
                'audit_source' => $audit->type === 'external' ? 'external' : 'internal',
                'audit_id' => $audit->id,
                'audit_reference' => "{$audit->code} — {$audit->title}",
                'clause_reference' => $item->clause_ref,
                'title' => mb_substr($item->question, 0, 255),
                'description' => $item->notes,
                'evidence' => $item->evidence,
                'function_id' => $audit->function_id,
                'raised_by' => $audit->leadAuditor?->name ?? $user->name,
                'created_by' => $user->id,
            ]);
            $finding->standards()->sync($audit->standards()->pluck('code')->all());
            $item->update(['finding_id' => $finding->id]);

            return $finding;
        });

        $this->audit->log($user, 'create', 'Finding', $finding->code, $finding->title,
            "Mengangkat temuan {$finding->code} dari checklist audit {$audit->code}.");

        return response()->json($this->present($audit->fresh()), 201);
    }

    /** Jadwal & checklist boleh diisi perencana maupun pelaksana audit, selama audit belum ditutup. */
    private function guardContent(Request $request, Audit $audit): ?JsonResponse
    {
        $user = $request->user();
        if (! $user->hasPermission(Permissions::AUDIT_PLAN) && ! $user->hasPermission(Permissions::AUDIT_CONDUCT)) {
            return response()->json(['message' => 'Anda tidak berwenang mengubah isi audit.'], 403);
        }
        if ($audit->isLocked()) {
            return response()->json(['message' => 'Audit yang sudah selesai/dibatalkan terkunci — jadwal & checklist tidak bisa diubah.'], 422);
        }

        return null;
    }

    private function validateSession(Request $request, bool $sometimes = false): array
    {
        $req = $sometimes ? 'sometimes' : 'required';

        return $request->validate([
            'starts_at' => [$req, 'date'],
            'ends_at' => ['sometimes', 'nullable', 'date', 'after_or_equal:starts_at'],
            'topic' => [$req, 'string', 'max:255'],
            'function_id' => ['sometimes', 'nullable', 'string', 'exists:org_functions,id'],
            'auditee' => ['sometimes', 'nullable', 'string', 'max:255'],
            'auditor' => ['sometimes', 'nullable', 'string', 'max:255'],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);
    }

    private function validateChecklist(Request $request, bool $sometimes = false): array
    {
        return $request->validate([
            'clause_ref' => ['sometimes', 'nullable', 'string', 'max:64'],
            'question' => [$sometimes ? 'sometimes' : 'required', 'string', 'max:2000'],
            'result' => ['sometimes', 'nullable', 'string', Rule::in(AuditChecklistItem::RESULTS)],
            'evidence' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'finding_id' => ['sometimes', 'nullable', 'integer', 'exists:findings,id'],
        ]);
    }

    private const RELATIONS = [
        'orgFunction:id,name', 'leadAuditor:id,name', 'standards:code,name', 'findings',
        'sessions.orgFunction:id,name', 'checklist.assessor:id,name', 'checklist.finding:id,code,status',
    ];

    private function present(Audit $audit): Audit
    {
        return $audit->load(self::RELATIONS);
    }
}
