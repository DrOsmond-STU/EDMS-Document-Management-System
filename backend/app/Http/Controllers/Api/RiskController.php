<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Risk;
use App\Models\RiskControl;
use App\Services\AuditLogger;
use App\Services\RiskScoring;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Register Risiko — manajemen risiko ISO 31000 & ISO 9001 klausul 6.1.
 * Tidak ada hapus (konsisten dengan Document/User/MasterData): status
 * `closed` adalah cara risiko "diselesaikan", bukan dihapus — jejak
 * penilaian & perlakuan risiko harus tetap tersimpan untuk audit.
 */
class RiskController extends Controller
{
    private const CATEGORIES = ['strategic', 'operational', 'compliance', 'financial', 'safety', 'security', 'environmental', 'reputational'];
    private const TREATMENTS = ['avoid', 'reduce', 'transfer', 'accept'];
    private const STATUSES = ['identified', 'assessed', 'treated', 'monitored', 'closed'];

    public function __construct(private AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::RISK_VIEW)) {
            return response()->json(['message' => 'Anda tidak berwenang melihat Register Risiko.'], 403);
        }

        $query = Risk::query()->with(['orgFunction:id,name', 'standards:code,name', 'controls']);

        if ($q = trim((string) $request->string('q'))) {
            $query->where(fn ($w) => $w
                ->where('title', 'like', "%{$q}%")
                ->orWhere('code', 'like', "%{$q}%")
                ->orWhere('description', 'like', "%{$q}%")
                ->orWhere('owner', 'like', "%{$q}%"));
        }
        if ($category = $request->string('category')->toString()) {
            $query->where('category', $category);
        }
        if ($level = $request->string('residual_level')->toString()) {
            $query->where('residual_level', $level);
        }
        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }
        if ($functionId = $request->string('function_id')->toString()) {
            $query->where('function_id', $functionId);
        }

        // Diurutkan di PHP, bukan ORDER BY kolom string 'low'..'extreme'
        // (urutan abjad tidak sama dengan urutan tingkat keparahan) —
        // register ini tidak pernah cukup besar untuk sorting di PHP
        // jadi masalah performa.
        $risks = $query->orderByDesc('id')->get();
        $rank = ['extreme' => 3, 'high' => 2, 'moderate' => 1, 'low' => 0];
        $risks = $risks->sortByDesc(fn (Risk $r) => [$rank[$r->residual_level] ?? -1, $r->id])->values();

        return response()->json([
            'risks' => $risks,
            'meta' => [
                'categories' => self::CATEGORIES,
                'treatments' => self::TREATMENTS,
                'statuses' => self::STATUSES,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::RISK_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang menambah risiko.'], 403);
        }

        $data = $this->validateRisk($request);

        $risk = DB::transaction(function () use ($data, $request) {
            $risk = Risk::create([
                'code' => Risk::nextCode(),
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'category' => $data['category'],
                'function_id' => $data['function_id'] ?? null,
                'owner' => $data['owner'] ?? null,
                'inherent_likelihood' => $data['inherent_likelihood'],
                'inherent_impact' => $data['inherent_impact'],
                'inherent_level' => RiskScoring::level($data['inherent_likelihood'], $data['inherent_impact']),
                'residual_likelihood' => $data['residual_likelihood'],
                'residual_impact' => $data['residual_impact'],
                'residual_level' => RiskScoring::level($data['residual_likelihood'], $data['residual_impact']),
                'treatment' => $data['treatment'],
                'treatment_plan' => $data['treatment_plan'] ?? null,
                'status' => $data['status'] ?? 'identified',
                'created_by' => $request->user()->id,
            ]);
            $risk->standards()->sync($data['standards'] ?? []);

            return $risk;
        });

        $this->audit->log($request->user(), 'create', 'Risk', $risk->code, $risk->title,
            "Menambahkan risiko \"{$risk->title}\" ({$risk->code}).");

        return response()->json($risk->load(['orgFunction:id,name', 'standards:code,name', 'controls']), 201);
    }

    public function update(Request $request, Risk $risk): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::RISK_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang mengubah risiko.'], 403);
        }

        $data = $this->validateRisk($request, sometimes: true);

        if (array_key_exists('inherent_likelihood', $data) || array_key_exists('inherent_impact', $data)) {
            $likelihood = $data['inherent_likelihood'] ?? $risk->inherent_likelihood;
            $impact = $data['inherent_impact'] ?? $risk->inherent_impact;
            $data['inherent_level'] = RiskScoring::level($likelihood, $impact);
        }
        if (array_key_exists('residual_likelihood', $data) || array_key_exists('residual_impact', $data)) {
            $likelihood = $data['residual_likelihood'] ?? $risk->residual_likelihood;
            $impact = $data['residual_impact'] ?? $risk->residual_impact;
            $data['residual_level'] = RiskScoring::level($likelihood, $impact);
        }

        $standards = $data['standards'] ?? null;
        unset($data['standards']);

        $risk->fill($data)->save();
        if ($standards !== null) {
            $risk->standards()->sync($standards);
        }

        $this->audit->log($request->user(), 'update', 'Risk', $risk->code, $risk->title,
            "Memperbarui risiko \"{$risk->title}\" ({$risk->code}).");

        return response()->json($risk->fresh()->load(['orgFunction:id,name', 'standards:code,name', 'controls']));
    }

    public function addControl(Request $request, Risk $risk): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::RISK_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang menambah kontrol.'], 403);
        }

        $data = $request->validate([
            'description' => ['required', 'string', 'max:2000'],
        ]);

        $control = RiskControl::create([
            'risk_id' => $risk->id,
            'description' => $data['description'],
            'created_by' => $request->user()->id,
        ]);

        $this->audit->log($request->user(), 'update', 'Risk', $risk->code, $risk->title,
            "Menambahkan kontrol pada risiko \"{$risk->title}\" ({$risk->code}).");

        return response()->json($control->load('creator:id,name'), 201);
    }

    /** Soft delete: risiko hilang dari register & perhitungan, jejaknya tetap di Audit Trail. */
    public function destroy(Request $request, Risk $risk): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::RISK_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang menghapus risiko.'], 403);
        }

        $risk->delete();
        $this->audit->log($request->user(), 'delete', 'Risk', $risk->code, $risk->title,
            "Menghapus risiko \"{$risk->title}\" ({$risk->code}).");

        return response()->json(['message' => 'Risiko dihapus.']);
    }

    public function updateControl(Request $request, Risk $risk, RiskControl $control): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::RISK_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang mengubah kontrol.'], 403);
        }
        if ($control->risk_id !== $risk->id) {
            return response()->json(['message' => 'Kontrol tidak ditemukan pada risiko ini.'], 404);
        }

        $control->update($request->validate(['description' => ['required', 'string', 'max:2000']]));
        $this->audit->log($request->user(), 'update', 'Risk', $risk->code, $risk->title,
            "Mengubah kontrol pada risiko \"{$risk->title}\" ({$risk->code}).");

        return response()->json($control->fresh()->load('creator:id,name'));
    }

    public function destroyControl(Request $request, Risk $risk, RiskControl $control): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::RISK_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang menghapus kontrol.'], 403);
        }
        if ($control->risk_id !== $risk->id) {
            return response()->json(['message' => 'Kontrol tidak ditemukan pada risiko ini.'], 404);
        }

        $control->delete();
        $this->audit->log($request->user(), 'delete', 'Risk', $risk->code, $risk->title,
            "Menghapus kontrol pada risiko \"{$risk->title}\" ({$risk->code}): ".mb_substr($control->description, 0, 120));

        return response()->json(['message' => 'Kontrol dihapus.']);
    }

    private function validateRisk(Request $request, bool $sometimes = false): array
    {
        $rule = fn (array $rules) => $sometimes ? array_merge(['sometimes'], $rules) : $rules;

        return $request->validate([
            'title' => $rule(['required', 'string', 'max:255']),
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'category' => $rule(['required', 'string', Rule::in(self::CATEGORIES)]),
            'function_id' => ['sometimes', 'nullable', 'string', 'exists:org_functions,id'],
            'owner' => ['sometimes', 'nullable', 'string', 'max:255'],
            'inherent_likelihood' => $rule(['required', 'integer', 'min:1', 'max:5']),
            'inherent_impact' => $rule(['required', 'integer', 'min:1', 'max:5']),
            'residual_likelihood' => $rule(['required', 'integer', 'min:1', 'max:5']),
            'residual_impact' => $rule(['required', 'integer', 'min:1', 'max:5']),
            'treatment' => $rule(['required', 'string', Rule::in(self::TREATMENTS)]),
            'treatment_plan' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'status' => ['sometimes', 'string', Rule::in(self::STATUSES)],
            'standards' => ['sometimes', 'array'],
            'standards.*' => ['string', 'exists:standards,code'],
        ]);
    }
}
