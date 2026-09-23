<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Finding;
use App\Models\FindingAction;
use App\Models\FindingVerification;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Register Temuan & CAPA — ketidaksesuaian (NC Major/Minor), OFI, observasi,
 * dan strength, lengkap dengan akar masalah (RCA), tindakan koreksi/preventif
 * (CAPA), verifikasi efektivitas, sampai penutupan. Alur status TIDAK bisa
 * diubah bebas lewat update() — hanya lewat aksi bertahap di bawah (tambah
 * RCA/CAPA/verifikasi/tutup/tolak), supaya urutan RCA→CAPA→Verifikasi→Tutup
 * yang ditegakkan close() selalu konsisten dengan riwayat sungguhan.
 */
class FindingController extends Controller
{
    private const TYPES = ['nc_major', 'nc_minor', 'ofi', 'observation', 'strength'];
    private const AUDIT_SOURCES = ['internal', 'external', 'other'];
    private const ACTION_TYPES = ['corrective', 'preventive'];
    private const ACTION_STATUSES = ['open', 'in_progress', 'completed'];
    private const VERIFICATION_METHODS = ['document_review', 'interview', 'observation', 'sampling'];

    public function __construct(private AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->canView($request)) {
            return response()->json(['message' => 'Anda tidak berwenang melihat Register Temuan & CAPA.'], 403);
        }

        $query = Finding::query()->with(['orgFunction:id,name', 'standards:code,name', 'actions', 'verifications', 'audit:id,code,type,title']);

        if ($q = trim((string) $request->string('q'))) {
            $query->where(fn ($w) => $w
                ->where('title', 'like', "%{$q}%")
                ->orWhere('code', 'like', "%{$q}%")
                ->orWhere('description', 'like', "%{$q}%")
                ->orWhere('owner', 'like', "%{$q}%"));
        }
        if ($source = $request->string('audit_source')->toString()) {
            $query->where('audit_source', $source);
        }
        if ($type = $request->string('type')->toString()) {
            $query->where('type', $type);
        }
        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }
        if ($functionId = $request->string('function_id')->toString()) {
            $query->where('function_id', $functionId);
        }
        if ($auditId = $request->string('audit_id')->toString()) {
            $query->where('audit_id', $auditId);
        }

        $findings = $query->orderByDesc('id')->get();

        return response()->json([
            'findings' => $findings,
            'meta' => [
                'types' => self::TYPES,
                'audit_sources' => self::AUDIT_SOURCES,
                'action_types' => self::ACTION_TYPES,
                'action_statuses' => self::ACTION_STATUSES,
                'verification_methods' => self::VERIFICATION_METHODS,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::FINDING_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang menambah temuan.'], 403);
        }

        $data = $request->validate([
            'type' => ['required', 'string', Rule::in(self::TYPES)],
            'audit_source' => ['required', 'string', Rule::in(self::AUDIT_SOURCES)],
            'audit_reference' => ['nullable', 'string', 'max:255'],
            'audit_id' => ['nullable', 'integer', 'exists:audits,id'],
            'clause_reference' => ['nullable', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'evidence' => ['nullable', 'string', 'max:5000'],
            'function_id' => ['nullable', 'string', 'exists:org_functions,id'],
            'owner' => ['nullable', 'string', 'max:255'],
            'raised_by' => ['nullable', 'string', 'max:255'],
            'due_date' => ['nullable', 'date'],
            'standards' => ['sometimes', 'array'],
            'standards.*' => ['string', 'exists:standards,code'],
        ]);

        $finding = DB::transaction(function () use ($data, $request) {
            $finding = Finding::create([
                'code' => Finding::nextCode(),
                'status' => 'open',
                'created_by' => $request->user()->id,
                ...collect($data)->except('standards')->all(),
            ]);
            $finding->standards()->sync($data['standards'] ?? []);

            return $finding;
        });

        $this->audit->log($request->user(), 'create', 'Finding', $finding->code, $finding->title,
            "Menambahkan temuan \"{$finding->title}\" ({$finding->code}).");

        return response()->json($this->present($finding), 201);
    }

    public function update(Request $request, Finding $finding): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::FINDING_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang mengubah temuan.'], 403);
        }

        $data = $request->validate([
            'type' => ['sometimes', 'string', Rule::in(self::TYPES)],
            'audit_source' => ['sometimes', 'string', Rule::in(self::AUDIT_SOURCES)],
            'audit_reference' => ['sometimes', 'nullable', 'string', 'max:255'],
            'audit_id' => ['sometimes', 'nullable', 'integer', 'exists:audits,id'],
            'clause_reference' => ['sometimes', 'nullable', 'string', 'max:255'],
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'evidence' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'function_id' => ['sometimes', 'nullable', 'string', 'exists:org_functions,id'],
            'owner' => ['sometimes', 'nullable', 'string', 'max:255'],
            'raised_by' => ['sometimes', 'nullable', 'string', 'max:255'],
            'due_date' => ['sometimes', 'nullable', 'date'],
            'standards' => ['sometimes', 'array'],
            'standards.*' => ['string', 'exists:standards,code'],
        ]);

        $standards = $data['standards'] ?? null;
        unset($data['standards']);

        $finding->fill($data)->save();
        if ($standards !== null) {
            $finding->standards()->sync($standards);
        }

        $this->audit->log($request->user(), 'update', 'Finding', $finding->code, $finding->title,
            "Memperbarui temuan \"{$finding->title}\" ({$finding->code}).");

        return response()->json($this->present($finding->fresh()));
    }

    public function addRootCause(Request $request, Finding $finding): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::FINDING_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang mengisi akar masalah.'], 403);
        }
        if (in_array($finding->status, ['closed', 'rejected'], true)) {
            return response()->json(['message' => 'Temuan yang sudah ditutup/ditolak tidak bisa diubah.'], 422);
        }

        $data = $request->validate(['root_cause' => ['required', 'string', 'max:5000']]);

        $finding->root_cause = $data['root_cause'];
        if ($finding->status === 'open') {
            $finding->status = 'root_cause_analysis';
        }
        $finding->save();

        $this->audit->log($request->user(), 'update', 'Finding', $finding->code, $finding->title,
            "Mengisi akar masalah pada temuan \"{$finding->title}\" ({$finding->code}).");

        return response()->json($this->present($finding->fresh()));
    }

    public function addAction(Request $request, Finding $finding): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::FINDING_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang menambah tindakan CAPA.'], 403);
        }
        if (in_array($finding->status, ['closed', 'rejected'], true)) {
            return response()->json(['message' => 'Temuan yang sudah ditutup/ditolak tidak bisa diubah.'], 422);
        }

        $data = $request->validate([
            'type' => ['required', 'string', Rule::in(self::ACTION_TYPES)],
            'description' => ['required', 'string', 'max:2000'],
            'pic' => ['required', 'string', 'max:255'],
            'due_date' => ['nullable', 'date'],
        ]);

        $action = FindingAction::create([
            'finding_id' => $finding->id,
            'type' => $data['type'],
            'description' => $data['description'],
            'pic' => $data['pic'],
            'due_date' => $data['due_date'] ?? null,
            'status' => 'open',
            'created_by' => $request->user()->id,
        ]);

        if (in_array($finding->status, ['open', 'root_cause_analysis'], true)) {
            $finding->status = 'capa_in_progress';
            $finding->save();
        }

        $this->audit->log($request->user(), 'update', 'Finding', $finding->code, $finding->title,
            "Menambahkan tindakan CAPA pada temuan \"{$finding->title}\" ({$finding->code}).");

        return response()->json($this->present($finding->fresh()), 201);
    }

    public function updateAction(Request $request, Finding $finding, FindingAction $action): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::FINDING_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang mengubah tindakan CAPA.'], 403);
        }
        if ($action->finding_id !== $finding->id) {
            return response()->json(['message' => 'Tindakan tidak ditemukan pada temuan ini.'], 404);
        }

        $data = $request->validate(['status' => ['required', 'string', Rule::in(self::ACTION_STATUSES)]]);
        $action->update($data);

        $this->audit->log($request->user(), 'update', 'Finding', $finding->code, $finding->title,
            "Memperbarui status tindakan CAPA menjadi \"{$data['status']}\" pada temuan \"{$finding->title}\" ({$finding->code}).");

        return response()->json($this->present($finding->fresh()));
    }

    public function addVerification(Request $request, Finding $finding): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::FINDING_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang menambah verifikasi.'], 403);
        }
        if (in_array($finding->status, ['closed', 'rejected'], true)) {
            return response()->json(['message' => 'Temuan yang sudah ditutup/ditolak tidak bisa diubah.'], 422);
        }

        $data = $request->validate([
            'method' => ['required', 'string', Rule::in(self::VERIFICATION_METHODS)],
            'effective' => ['required', 'boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        FindingVerification::create([
            'finding_id' => $finding->id,
            'method' => $data['method'],
            'effective' => $data['effective'],
            'notes' => $data['notes'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        if ($finding->status === 'capa_in_progress') {
            $finding->status = 'verification';
            $finding->save();
        }

        $this->audit->log($request->user(), 'update', 'Finding', $finding->code, $finding->title,
            "Menambahkan verifikasi (".($data['effective'] ? 'efektif' : 'belum efektif').") pada temuan \"{$finding->title}\" ({$finding->code}).");

        return response()->json($this->present($finding->fresh()), 201);
    }

    public function close(Request $request, Finding $finding): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::FINDING_CLOSE)) {
            return response()->json(['message' => 'Anda tidak berwenang menutup temuan.'], 403);
        }
        if (in_array($finding->status, ['closed', 'rejected'], true)) {
            return response()->json(['message' => 'Temuan ini sudah ditutup/ditolak.'], 422);
        }

        $finding->loadMissing('actions', 'verifications');
        $missing = [];
        if (! $finding->root_cause) {
            $missing[] = 'akar masalah (RCA) belum diisi';
        }
        if ($finding->actions->isEmpty() || $finding->actions->contains(fn ($a) => $a->status !== 'completed')) {
            $missing[] = 'masih ada tindakan CAPA yang belum selesai';
        }
        if (! $finding->verifications->contains(fn ($v) => $v->effective)) {
            $missing[] = 'belum ada verifikasi yang menyatakan efektif';
        }
        if ($missing !== []) {
            return response()->json(['message' => 'Temuan belum bisa ditutup: '.implode('; ', $missing).'.'], 422);
        }

        $finding->status = 'closed';
        $finding->save();

        $this->audit->log($request->user(), 'update', 'Finding', $finding->code, $finding->title,
            "Menutup temuan \"{$finding->title}\" ({$finding->code}).");

        return response()->json($this->present($finding->fresh()));
    }

    public function reject(Request $request, Finding $finding): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::FINDING_CLOSE)) {
            return response()->json(['message' => 'Anda tidak berwenang menolak temuan.'], 403);
        }
        if (in_array($finding->status, ['closed', 'rejected'], true)) {
            return response()->json(['message' => 'Temuan ini sudah ditutup/ditolak.'], 422);
        }

        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);

        $finding->status = 'rejected';
        $finding->rejection_reason = $data['reason'];
        $finding->save();

        $this->audit->log($request->user(), 'update', 'Finding', $finding->code, $finding->title,
            "Menolak temuan \"{$finding->title}\" ({$finding->code}): {$data['reason']}");

        return response()->json($this->present($finding->fresh()));
    }

    private function present(Finding $finding): Finding
    {
        return $finding->load(['orgFunction:id,name', 'standards:code,name', 'actions', 'verifications', 'audit:id,code,type,title']);
    }

    private function canView(Request $request): bool
    {
        $user = $request->user();

        return $user->hasPermission(Permissions::AUDIT_VIEW)
            || $user->hasPermission(Permissions::FINDING_MANAGE)
            || $user->hasPermission(Permissions::FINDING_CLOSE);
    }
}
