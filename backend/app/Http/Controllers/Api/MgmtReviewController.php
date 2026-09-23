<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Models\Finding;
use App\Models\MgmtReview;
use App\Models\MgmtReviewAction;
use App\Models\Risk;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Tinjauan Manajemen — rapat management review ISO 9001 klausul 9.3.
 * Tidak ada hapus: status `cancelled` untuk rapat yang batal. Rapat yang
 * sudah `completed` dikunci dari edit (notulen resmi), tapi action item
 * tetap bisa diperbarui statusnya karena tindak lanjut berjalan setelah
 * rapat selesai.
 */
class MgmtReviewController extends Controller
{
    private const STATUSES = ['scheduled', 'completed', 'cancelled'];
    private const ACTION_STATUSES = ['open', 'in_progress', 'completed'];

    public function __construct(private AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::MGMT_REVIEW_VIEW)) {
            return response()->json(['message' => 'Anda tidak berwenang melihat Tinjauan Manajemen.'], 403);
        }

        $query = MgmtReview::query()->with(['chair:id,name', 'actions']);
        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        return response()->json([
            'reviews' => $query->orderByDesc('meeting_date')->orderByDesc('id')->get(),
            'snapshot' => $this->snapshot(),
            'meta' => ['statuses' => self::STATUSES, 'action_statuses' => self::ACTION_STATUSES],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::MGMT_REVIEW_CHAIR)) {
            return response()->json(['message' => 'Anda tidak berwenang menjadwalkan tinjauan manajemen.'], 403);
        }

        $data = $this->validateReview($request);

        $review = DB::transaction(fn () => MgmtReview::create([
            'code' => MgmtReview::nextCode(),
            'status' => 'scheduled',
            'created_by' => $request->user()->id,
            ...$data,
        ]));

        $this->audit->log($request->user(), 'create', 'MgmtReview', $review->code, $review->title,
            "Menjadwalkan tinjauan manajemen \"{$review->title}\" ({$review->code}).");

        return response()->json($this->present($review), 201);
    }

    public function update(Request $request, MgmtReview $mgmtReview): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::MGMT_REVIEW_CHAIR)) {
            return response()->json(['message' => 'Anda tidak berwenang mengubah tinjauan manajemen.'], 403);
        }
        if ($mgmtReview->status !== 'scheduled') {
            return response()->json(['message' => 'Notulen tinjauan yang sudah selesai/dibatalkan tidak bisa diubah.'], 422);
        }

        $mgmtReview->fill($this->validateReview($request, sometimes: true))->save();

        $this->audit->log($request->user(), 'update', 'MgmtReview', $mgmtReview->code, $mgmtReview->title,
            "Memperbarui notulen tinjauan manajemen \"{$mgmtReview->title}\" ({$mgmtReview->code}).");

        return response()->json($this->present($mgmtReview->fresh()));
    }

    public function transition(Request $request, MgmtReview $mgmtReview): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::MGMT_REVIEW_CHAIR)) {
            return response()->json(['message' => 'Anda tidak berwenang mengubah status tinjauan manajemen.'], 403);
        }

        $data = $request->validate(['action' => ['required', 'string', Rule::in(['complete', 'cancel'])]]);

        if ($mgmtReview->status !== 'scheduled') {
            return response()->json(['message' => 'Hanya tinjauan berstatus terjadwal yang bisa diselesaikan/dibatalkan.'], 422);
        }

        if ($data['action'] === 'complete') {
            // Klausul 9.3.3 mewajibkan output — rapat tidak boleh ditutup
            // tanpa satu pun keputusan/kebutuhan sumber daya/perubahan SMM.
            if (! $mgmtReview->decisions && ! $mgmtReview->resource_needs && ! $mgmtReview->system_changes) {
                return response()->json(['message' => 'Isi minimal satu output tinjauan (keputusan, kebutuhan sumber daya, atau perubahan SMM) sebelum menutup rapat.'], 422);
            }
            $mgmtReview->status = 'completed';
            $verb = 'Menyelesaikan';
        } else {
            $mgmtReview->status = 'cancelled';
            $verb = 'Membatalkan';
        }
        $mgmtReview->save();

        $this->audit->log($request->user(), 'update', 'MgmtReview', $mgmtReview->code, $mgmtReview->title,
            "{$verb} tinjauan manajemen \"{$mgmtReview->title}\" ({$mgmtReview->code}).");

        return response()->json($this->present($mgmtReview->fresh()));
    }

    public function addAction(Request $request, MgmtReview $mgmtReview): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::MGMT_REVIEW_CHAIR)) {
            return response()->json(['message' => 'Anda tidak berwenang menambah tindak lanjut.'], 403);
        }
        if ($mgmtReview->status === 'cancelled') {
            return response()->json(['message' => 'Tinjauan yang dibatalkan tidak bisa diberi tindak lanjut.'], 422);
        }

        $data = $request->validate([
            'description' => ['required', 'string', 'max:2000'],
            'pic' => ['nullable', 'string', 'max:255'],
            'due_date' => ['nullable', 'date'],
        ]);

        $action = MgmtReviewAction::create([
            'mgmt_review_id' => $mgmtReview->id,
            'status' => 'open',
            'created_by' => $request->user()->id,
            ...$data,
        ]);

        $this->audit->log($request->user(), 'update', 'MgmtReview', $mgmtReview->code, $mgmtReview->title,
            "Menambahkan tindak lanjut pada tinjauan manajemen ({$mgmtReview->code}).");

        return response()->json($action, 201);
    }

    public function updateAction(Request $request, MgmtReview $mgmtReview, MgmtReviewAction $action): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::MGMT_REVIEW_CHAIR)) {
            return response()->json(['message' => 'Anda tidak berwenang memperbarui tindak lanjut.'], 403);
        }
        if ($action->mgmt_review_id !== $mgmtReview->id) {
            abort(404);
        }

        $data = $request->validate(['status' => ['required', 'string', Rule::in(self::ACTION_STATUSES)]]);
        $action->update($data);

        $this->audit->log($request->user(), 'update', 'MgmtReview', $mgmtReview->code, $mgmtReview->title,
            "Mengubah status tindak lanjut tinjauan manajemen ({$mgmtReview->code}) menjadi {$data['status']}.");

        return response()->json($action->fresh());
    }

    /**
     * Ringkasan data SUNGGUHAN dari modul lain sebagai bahan input rapat
     * (klausul 9.3.2 c) — dihitung saat diminta, bukan disimpan, supaya
     * selalu mencerminkan kondisi terkini saat notulen disusun.
     */
    private function snapshot(): array
    {
        return [
            'findings_open' => Finding::whereNotIn('status', ['closed', 'rejected'])->count(),
            'findings_nc_major_open' => Finding::where('type', 'nc_major')->whereNotIn('status', ['closed', 'rejected'])->count(),
            'findings_closed' => Finding::where('status', 'closed')->count(),
            'risks_high_extreme' => Risk::whereIn('residual_level', ['high', 'extreme'])->where('status', '!=', 'closed')->count(),
            'risks_total_open' => Risk::where('status', '!=', 'closed')->count(),
            'audits_completed' => Audit::where('status', 'completed')->count(),
            'audits_planned' => Audit::whereIn('status', ['planned', 'in_progress'])->count(),
        ];
    }

    private function validateReview(Request $request, bool $sometimes = false): array
    {
        $rule = fn (array $rules) => $sometimes ? array_merge(['sometimes'], $rules) : $rules;
        $text = ['sometimes', 'nullable', 'string', 'max:10000'];

        return $request->validate([
            'title' => $rule(['required', 'string', 'max:255']),
            'meeting_date' => $rule(['required', 'date']),
            'chair_id' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
            'attendees' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'previous_actions_status' => $text,
            'internal_external_changes' => $text,
            'performance_summary' => $text,
            'resource_adequacy' => $text,
            'risk_opportunity_effectiveness' => $text,
            'improvement_opportunities' => $text,
            'decisions' => $text,
            'resource_needs' => $text,
            'system_changes' => $text,
        ]);
    }

    private function present(MgmtReview $review): MgmtReview
    {
        return $review->load(['chair:id,name', 'actions']);
    }
}
