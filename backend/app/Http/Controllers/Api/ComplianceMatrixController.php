<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClauseAssessment;
use App\Models\Document;
use App\Models\Standard;
use App\Models\StandardClause;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Compliance Matrix — matriks Klausul × Dokumen sungguhan (bukan ringkasan
 * per standar seperti versi sebelumnya): tiap sel dinilai manual oleh
 * Compliance Admin (compliant/partial/gap), bukan dihitung otomatis dari
 * status dokumen, karena "dokumen X memenuhi klausul Y" adalah penilaian
 * substansi yang perlu dibaca manusia. Gaya & struktur mengikuti purwarupa
 * lama (bundel JS dibaca langsung dari server — lihat riwayat commit),
 * dengan klausul yang benar-benar tersimpan sebagai master data
 * (StandardClause), bukan data statis di frontend.
 */
class ComplianceMatrixController extends Controller
{
    private const STATUSES = ['compliant', 'partial', 'gap'];

    public function __construct(private AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::REPORTING_VIEW)) {
            return response()->json(['message' => 'Anda tidak berwenang melihat Compliance Matrix.'], 403);
        }

        $standardFilter = $request->string('standard')->toString();

        $clauseQuery = StandardClause::query()->orderBy('standard_code')->orderBy('sort_order');
        if ($standardFilter) {
            $clauseQuery->where('standard_code', $standardFilter);
        }
        $clauses = $clauseQuery->get(['id', 'standard_code', 'code', 'title']);

        $documents = Document::query()->classifiedFor($request->user())->orderBy('code')->get(['id', 'code', 'title', 'status']);

        $clauseIds = $clauses->pluck('id');
        $assessments = ClauseAssessment::query()
            ->whereIn('clause_id', $clauseIds)
            ->whereIn('document_id', $documents->pluck('id'))
            ->with('assessor:id,name')
            ->get()
            ->keyBy(fn (ClauseAssessment $a) => "{$a->clause_id}:{$a->document_id}");

        $cells = $assessments->map(fn (ClauseAssessment $a) => [
            'clause_id' => $a->clause_id,
            'document_id' => $a->document_id,
            'status' => $a->status,
            'note' => $a->note,
            'assessed_by' => $a->assessor?->name,
            'assessed_at' => $a->assessed_at,
        ])->values();

        $totalCells = $clauses->count() * $documents->count();
        $counts = ['compliant' => 0, 'partial' => 0, 'gap' => 0];
        foreach ($assessments as $a) {
            $counts[$a->status] = ($counts[$a->status] ?? 0) + 1;
        }

        $standards = Standard::where('active', true)
            ->withCount('clauses')
            ->orderBy('code')
            ->get()
            ->map(fn (Standard $s) => ['code' => $s->code, 'name' => $s->name, 'clauses_count' => $s->clauses_count]);

        return response()->json([
            'clauses' => $clauses,
            'documents' => $documents,
            'cells' => $cells,
            'standards' => $standards,
            'stats' => [
                'total_cells' => $totalCells,
                'assessed_cells' => $assessments->count(),
                'compliant' => $counts['compliant'],
                'partial' => $counts['partial'],
                'gap' => $counts['gap'],
                'unassessed' => max(0, $totalCells - $assessments->count()),
            ],
        ]);
    }

    public function upsertAssessment(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::COMPLIANCE_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang menilai Compliance Matrix.'], 403);
        }

        $data = $request->validate([
            'clause_id' => ['required', 'integer', 'exists:standard_clauses,id'],
            'document_id' => ['required', 'integer', 'exists:documents,id'],
            'status' => ['nullable', 'string', Rule::in(self::STATUSES)],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $clause = StandardClause::findOrFail($data['clause_id']);
        $document = Document::findOrFail($data['document_id']);
        if (! $document->classificationAllows($request->user())) {
            return response()->json(['message' => 'Klasifikasi dokumen ini di atas izin akses Anda.'], 403);
        }

        if ($data['status'] === null) {
            ClauseAssessment::where('clause_id', $data['clause_id'])->where('document_id', $data['document_id'])->delete();

            $this->audit->log($request->user(), 'update', 'ClauseAssessment', "{$clause->standard_code} {$clause->code}",
                "{$clause->standard_code} {$clause->code} × {$document->code}",
                "Mengosongkan penilaian klausul {$clause->standard_code} {$clause->code} terhadap dokumen {$document->code}.");

            return response()->json(['cleared' => true]);
        }

        $assessment = ClauseAssessment::updateOrCreate(
            ['clause_id' => $data['clause_id'], 'document_id' => $data['document_id']],
            [
                'status' => $data['status'],
                'note' => $data['note'] ?? null,
                'assessed_by' => $request->user()->id,
                'assessed_at' => now(),
            ],
        );

        $this->audit->log($request->user(), 'update', 'ClauseAssessment', "{$clause->standard_code} {$clause->code}",
            "{$clause->standard_code} {$clause->code} × {$document->code}",
            "Menilai klausul {$clause->standard_code} {$clause->code} terhadap dokumen {$document->code}: {$data['status']}.");

        return response()->json($assessment->load('assessor:id,name'));
    }
}
