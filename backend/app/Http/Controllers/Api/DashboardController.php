<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Document;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Dashboard Analytics — ringkasan angka lintas modul di satu layar: sebaran
 * status/klasifikasi/jenis dokumen, dokumen yang jatuh tempo tinjauan ulang,
 * berapa banyak menunggu tindakan peran pengguna sendiri, dan (untuk peran
 * berwenang) tren pembuatan dokumen serta aktivitas audit terbaru.
 *
 * Sengaja HANYA baca (tidak ada aksi di sini) dan tidak menulis AuditLog —
 * melihat dashboard bukan peristiwa yang perlu diaudit, berbeda dengan
 * melihat/mengunduh berkas dokumen terkontrol.
 *
 * Blok bersyarat (users/recent_activity/monthly_trend) null bila pengguna
 * tidak berwenang, bukan disembunyikan lewat 403 — dashboard tetap satu
 * layar untuk semua peran, hanya kartunya yang berbeda sesuai hak akses.
 */
class DashboardController extends Controller
{
    /** Urutan tetap agar tampilan grafik status konsisten antar respons. */
    private const STATUSES = ['draft', 'review', 'approval', 'released', 'obsolete', 'frozen', 'revoked', 'cancelled'];
    private const CLASSIFICATIONS = ['public', 'internal', 'restricted', 'confidential', 'secret', 'top_secret'];
    private const TYPES = ['Kebijakan', 'Manual', 'SOP', 'Work Instruction', 'Formulir'];
    private const BOARD_STATUSES = ['draft', 'review', 'approval'];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $roleIds = $user->roleIds();

        $statusCounts = Document::query()->selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status');
        $classificationCounts = Document::query()->selectRaw('classification, count(*) as c')->groupBy('classification')->pluck('c', 'classification');
        $typeCounts = Document::query()->selectRaw('type, count(*) as c')->groupBy('type')->pluck('c', 'type');

        $totalDocuments = (int) $statusCounts->sum();
        $pendingCount = (int) collect(self::BOARD_STATUSES)->sum(fn ($s) => (int) ($statusCounts[$s] ?? 0));

        $overdueReview = Document::released()->whereNotNull('review_date')->where('review_date', '<', now())->count();
        $upcomingReview = Document::released()->whereNotNull('review_date')
            ->whereBetween('review_date', [now(), now()->addDays(30)])
            ->count();

        $myActionableStatuses = array_values(array_filter(
            self::BOARD_STATUSES,
            fn ($status) => Permissions::canTransitionFrom($roleIds, $status),
        ));
        $myActionableCount = $myActionableStatuses === []
            ? 0
            : Document::whereIn('status', $myActionableStatuses)->count();

        $payload = [
            'totals' => [
                'documents' => $totalDocuments,
                'released' => (int) ($statusCounts['released'] ?? 0),
                'pending' => $pendingCount,
                'overdue_review' => $overdueReview,
                'upcoming_review' => $upcomingReview,
                'my_actionable' => $myActionableCount,
            ],
            'status_breakdown' => collect(self::STATUSES)
                ->map(fn ($s) => ['key' => $s, 'count' => (int) ($statusCounts[$s] ?? 0)])
                ->values(),
            'classification_breakdown' => collect(self::CLASSIFICATIONS)
                ->map(fn ($c) => ['key' => $c, 'count' => (int) ($classificationCounts[$c] ?? 0)])
                ->values(),
            'type_breakdown' => collect(self::TYPES)
                ->map(fn ($t) => ['key' => $t, 'count' => (int) ($typeCounts[$t] ?? 0)])
                ->values(),
            'users' => null,
            'recent_activity' => null,
            'monthly_trend' => null,
        ];

        if ($user->hasPermission(Permissions::USERS_MANAGE)) {
            $payload['users'] = [
                'active' => User::where('active', true)->count(),
                'inactive' => User::where('active', false)->count(),
            ];
        }

        if ($user->hasPermission(Permissions::AUDIT_VIEW)) {
            $payload['recent_activity'] = AuditLog::with('actor:id,name')
                ->latest()
                ->limit(8)
                ->get()
                ->map(fn (AuditLog $log) => [
                    'id' => $log->id,
                    'actor_name' => $log->actor?->name ?? $log->actor_name,
                    'action' => $log->action,
                    'entity' => $log->entity,
                    'entity_label' => $log->entity_label,
                    'created_at' => $log->created_at,
                ])
                ->values();
        }

        if ($user->hasPermission(Permissions::REPORTING_VIEW)) {
            $payload['monthly_trend'] = $this->monthlyTrend();
        }

        return response()->json($payload);
    }

    /**
     * Dikelompokkan di PHP, bukan lewat DATE_FORMAT/strftime di query —
     * fungsi format tanggal SQL berbeda antar driver (MySQL di produksi,
     * SQLite di test), dan volume dokumen tidak pernah cukup besar untuk
     * grouping di PHP jadi masalah performa.
     *
     * @return list<array{month: string, count: int}>
     */
    private function monthlyTrend(): array
    {
        $start = now()->subMonths(5)->startOfMonth();

        $counts = Document::query()
            ->where('created_at', '>=', $start)
            ->pluck('created_at')
            ->countBy(fn ($date) => $date->format('Y-m'));

        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $key = now()->subMonths($i)->format('Y-m');
            $months[] = ['month' => $key, 'count' => (int) ($counts[$key] ?? 0)];
        }

        return $months;
    }
}
