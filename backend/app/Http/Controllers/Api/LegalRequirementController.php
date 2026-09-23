<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LegalEvaluation;
use App\Models\LegalRequirement;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Legal Register — peraturan perundang-undangan & persyaratan lain yang
 * berlaku bagi organisasi, plus evaluasi kepatuhan berkala. Status
 * kepatuhan di baris utama HANYA berubah lewat evaluate() (yang sekaligus
 * mencatat riwayat), bukan lewat update() — supaya tidak ada status
 * "Patuh" tanpa jejak evaluasi yang mendasarinya.
 */
class LegalRequirementController extends Controller
{
    private const REGULATION_TYPES = ['uu', 'pp', 'perpres', 'permen', 'perda', 'keputusan', 'sni', 'lainnya'];
    private const CATEGORIES = ['lingkungan', 'k3', 'ketenagakerjaan', 'mutu', 'keamanan_informasi', 'anti_penyuapan', 'umum'];
    private const STATUSES = ['active', 'revoked', 'replaced'];
    private const COMPLIANCE_STATUSES = ['compliant', 'partial', 'non_compliant'];

    public function __construct(private AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::LEGAL_VIEW)) {
            return response()->json(['message' => 'Anda tidak berwenang melihat Legal Register.'], 403);
        }

        $query = LegalRequirement::query()->with(['orgFunction:id,name', 'evaluations.evaluator:id,name']);

        if ($q = trim((string) $request->string('q'))) {
            $query->where(fn ($w) => $w
                ->where('title', 'like', "%{$q}%")
                ->orWhere('code', 'like', "%{$q}%")
                ->orWhere('regulation_number', 'like', "%{$q}%")
                ->orWhere('issuer', 'like', "%{$q}%"));
        }
        foreach (['category', 'status', 'compliance_status', 'regulation_type', 'function_id'] as $filter) {
            if ($value = $request->string($filter)->toString()) {
                $query->where($filter, $value);
            }
        }
        if ($request->boolean('overdue')) {
            $query->where('status', 'active')->whereDate('next_evaluation_at', '<', now()->toDateString());
        }

        $items = $query->orderBy('code')->get();

        $active = LegalRequirement::where('status', 'active');
        $stats = [
            'total_active' => (clone $active)->count(),
            'compliant' => (clone $active)->where('compliance_status', 'compliant')->count(),
            'partial' => (clone $active)->where('compliance_status', 'partial')->count(),
            'non_compliant' => (clone $active)->where('compliance_status', 'non_compliant')->count(),
            'not_evaluated' => (clone $active)->where('compliance_status', 'not_evaluated')->count(),
            'evaluation_overdue' => (clone $active)->whereDate('next_evaluation_at', '<', now()->toDateString())->count(),
        ];

        return response()->json([
            'items' => $items,
            'stats' => $stats,
            'meta' => [
                'regulation_types' => self::REGULATION_TYPES,
                'categories' => self::CATEGORIES,
                'statuses' => self::STATUSES,
                'compliance_statuses' => self::COMPLIANCE_STATUSES,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::LEGAL_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang menambah peraturan.'], 403);
        }

        $data = $this->validateItem($request);

        $item = DB::transaction(fn () => LegalRequirement::create([
            'code' => LegalRequirement::nextCode(),
            'status' => 'active',
            'compliance_status' => 'not_evaluated',
            'created_by' => $request->user()->id,
            ...$data,
        ]));

        $this->audit->log($request->user(), 'create', 'LegalRequirement', $item->code, $item->title,
            "Menambahkan peraturan \"{$item->title}\" ({$item->code}) ke Legal Register.");

        return response()->json($this->present($item), 201);
    }

    public function update(Request $request, LegalRequirement $legalRequirement): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::LEGAL_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang mengubah peraturan.'], 403);
        }

        $data = $this->validateItem($request, sometimes: true);
        $legalRequirement->fill($data)->save();

        $this->audit->log($request->user(), 'update', 'LegalRequirement', $legalRequirement->code, $legalRequirement->title,
            "Memperbarui peraturan \"{$legalRequirement->title}\" ({$legalRequirement->code}).");

        return response()->json($this->present($legalRequirement->fresh()));
    }

    public function destroy(Request $request, LegalRequirement $legalRequirement): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::LEGAL_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang menghapus peraturan.'], 403);
        }

        $legalRequirement->delete();
        $this->audit->log($request->user(), 'delete', 'LegalRequirement', $legalRequirement->code, $legalRequirement->title,
            "Menghapus peraturan \"{$legalRequirement->title}\" ({$legalRequirement->code}) dari Legal Register.");

        return response()->json(['message' => 'Peraturan dihapus.']);
    }

    public function evaluate(Request $request, LegalRequirement $legalRequirement): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::LEGAL_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang mengevaluasi kepatuhan.'], 403);
        }
        if ($legalRequirement->status !== 'active') {
            return response()->json(['message' => 'Hanya peraturan yang masih berlaku yang bisa dievaluasi.'], 422);
        }

        $data = $request->validate([
            'compliance_status' => ['required', 'string', Rule::in(self::COMPLIANCE_STATUSES)],
            'evaluation_date' => ['required', 'date', 'before_or_equal:today'],
            'evidence' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'next_evaluation_at' => ['nullable', 'date', 'after:evaluation_date'],
        ]);

        DB::transaction(function () use ($data, $legalRequirement, $request) {
            LegalEvaluation::create([
                'legal_requirement_id' => $legalRequirement->id,
                'compliance_status' => $data['compliance_status'],
                'evaluation_date' => $data['evaluation_date'],
                'evidence' => $data['evidence'] ?? null,
                'notes' => $data['notes'] ?? null,
                'evaluated_by' => $request->user()->id,
            ]);

            // Baris utama mencerminkan evaluasi TERBARU menurut tanggal —
            // evaluasi susulan bertanggal lebih lama tidak menimpa status kini.
            $latest = $legalRequirement->evaluations()->first();
            $legalRequirement->compliance_status = $latest->compliance_status;
            $legalRequirement->last_evaluated_at = $latest->evaluation_date;
            if (array_key_exists('next_evaluation_at', $data)) {
                $legalRequirement->next_evaluation_at = $data['next_evaluation_at'];
            }
            $legalRequirement->save();
        });

        $this->audit->log($request->user(), 'update', 'LegalRequirement', $legalRequirement->code, $legalRequirement->title,
            "Mengevaluasi kepatuhan \"{$legalRequirement->title}\" ({$legalRequirement->code}): {$data['compliance_status']}.");

        return response()->json($this->present($legalRequirement->fresh()));
    }

    private function validateItem(Request $request, bool $sometimes = false): array
    {
        $rule = fn (array $rules) => $sometimes ? array_merge(['sometimes'], $rules) : $rules;
        $text = ['sometimes', 'nullable', 'string', 'max:10000'];

        return $request->validate([
            'title' => $rule(['required', 'string', 'max:255']),
            'regulation_number' => ['sometimes', 'nullable', 'string', 'max:255'],
            'regulation_type' => $rule(['required', 'string', Rule::in(self::REGULATION_TYPES)]),
            'issuer' => ['sometimes', 'nullable', 'string', 'max:255'],
            'issued_date' => ['sometimes', 'nullable', 'date'],
            'category' => $rule(['required', 'string', Rule::in(self::CATEGORIES)]),
            'summary' => $text,
            'applicable_clauses' => $text,
            'obligations' => $text,
            'function_id' => ['sometimes', 'nullable', 'string', 'exists:org_functions,id'],
            'owner' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', 'string', Rule::in(self::STATUSES)],
            'next_evaluation_at' => ['sometimes', 'nullable', 'date'],
        ]);
    }

    private function present(LegalRequirement $item): LegalRequirement
    {
        return $item->load(['orgFunction:id,name', 'evaluations.evaluator:id,name']);
    }
}
