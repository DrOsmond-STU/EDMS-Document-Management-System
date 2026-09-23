<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiGeneration;
use App\Models\Audit;
use App\Models\AuditLog;
use App\Models\ClauseAssessment;
use App\Models\Document;
use App\Models\DraftingProject;
use App\Models\Finding;
use App\Models\LegalRequirement;
use App\Models\MgmtReviewAction;
use App\Models\Record;
use App\Models\Risk;
use App\Models\StandardClause;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Reporting & KPI — 8 KPI PRD §9 plus KPI modul governance. Semua angka
 * dihitung langsung dari data transaksi; KPI yang sumber datanya belum
 * ada (modul belum dibangun) dikembalikan berstatus `na` dengan alasan,
 * BUKAN diisi angka karangan. Agregasi dilakukan di PHP bila perlu
 * selisih tanggal, supaya sama persis di SQLite (test) dan MySQL (produksi).
 */
class ReportingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::REPORTING_VIEW)) {
            return response()->json(['message' => 'Anda tidak berwenang melihat Reporting & KPI.'], 403);
        }

        [$year, $from, $to] = $this->period($request);

        return response()->json([
            'year' => $year,
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'kpis' => $this->prdKpis($from, $to),
            'governance' => $this->governanceKpis($from, $to),
            'monthly' => $this->monthly($year),
            'cycle_by_standard' => $this->cycleByStandard($from, $to),
            'top_documents' => $this->topDocuments($from, $to),
        ]);
    }

    public function export(Request $request): StreamedResponse|JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::REPORTING_VIEW)) {
            return response()->json(['message' => 'Anda tidak berwenang mengekspor laporan.'], 403);
        }

        [$year, $from, $to] = $this->period($request);
        $rows = [...$this->prdKpis($from, $to), ...$this->governanceKpis($from, $to)];

        return response()->streamDownload(function () use ($rows, $year) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM supaya Excel membaca UTF-8 dengan benar
            fputcsv($out, ['Periode', 'KPI', 'Nilai', 'Satuan', 'Target', 'Status', 'Keterangan'], ';');
            foreach ($rows as $k) {
                fputcsv($out, array_map([self::class, 'csvCell'], [$year, $k['label'], $k['value'] ?? '-', $k['unit'] ?? '', $k['target'] ?? '', $k['status'], $k['description']]), ';');
            }
            fclose($out);
        }, "kpi-edms-{$year}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** @return array{0:int,1:Carbon,2:Carbon} */
    private function period(Request $request): array
    {
        $year = (int) $request->integer('year', (int) now()->format('Y'));
        $year = max(2000, min($year, (int) now()->format('Y')));
        $from = Carbon::create($year, 1, 1)->startOfDay();
        $to = $year === (int) now()->format('Y') ? now()->endOfDay() : Carbon::create($year, 12, 31)->endOfDay();

        return [$year, $from, $to];
    }

    private function kpi(string $key, string $label, $value, ?string $unit, string $status, string $description, ?string $target = null): array
    {
        return compact('key', 'label', 'value', 'unit', 'status', 'description', 'target');
    }

    private function na(string $key, string $label, string $why): array
    {
        return $this->kpi($key, $label, null, null, 'na', $why);
    }

    private function pct(int $num, int $den): ?float
    {
        return $den > 0 ? round($num * 100 / $den, 1) : null;
    }

    /** Dokumen yang lahir dari proyek penyusunan — dipisah dari siklus approval normal. */
    private function draftingDocumentIds(): array
    {
        return DraftingProject::whereNotNull('document_id')->pluck('document_id')->all();
    }

    private function prdKpis(Carbon $from, Carbon $to): array
    {
        $today = now()->toDateString();
        $draftingDocs = $this->draftingDocumentIds();

        // 1. Waktu siklus Draft → Released (dokumen jalur approval biasa yang berlaku dalam periode)
        $cycles = Document::where('status', 'released')->whereNotNull('effective_date')
            ->whereDate('effective_date', '>=', $from->toDateString())->whereDate('effective_date', '<=', $to->toDateString())
            ->whereNotIn('id', $draftingDocs)->get(['created_at', 'effective_date'])
            ->map(fn ($d) => max(0, $d->created_at->startOfDay()->diffInDays($d->effective_date, false)));
        $avgCycle = $cycles->isNotEmpty() ? round($cycles->avg(), 1) : null;

        // 2. Cakupan kepatuhan klausul
        $totalClauses = StandardClause::count();
        $coveredClauses = ClauseAssessment::where('status', 'compliant')->distinct('clause_id')->count('clause_id');
        $coverage = $this->pct($coveredClauses, $totalClauses);

        // 3. Dokumen lewat tinjau ulang
        // Sama dengan Dashboard & Document::display_validity: jatuh tempo HARI INI sudah dihitung lewat.
        $overdue = Document::where('status', 'released')->whereNotNull('review_date')->whereDate('review_date', '<=', $today)->count();

        // 4. Pemanfaatan dokumen (lihat/unduh berkas)
        $usage = AuditLog::whereIn('action', ['view', 'download'])->whereBetween('created_at', [$from, $to])->count();

        // 7. Kelengkapan jejak penyusunan
        $newDocs = Document::whereBetween('created_at', [$from, $to])->count();
        $viaDrafting = Document::whereBetween('created_at', [$from, $to])->whereIn('id', $draftingDocs)->count();

        // 6. Adopsi Asisten AI: porsi hasil AI yang ditindaklanjuti menjadi permintaan penyusunan
        $aiTotal = AiGeneration::whereBetween('created_at', [$from, $to])->count();
        $aiUsed = AiGeneration::whereBetween('created_at', [$from, $to])->whereNotNull('followed_up_at')->count();
        $aiPct = $this->pct($aiUsed, $aiTotal);

        // 8. Indikator keamanan
        $failedLogins = AuditLog::whereIn('action', ['login_failed', 'account_locked'])->whereBetween('created_at', [$from, $to])->count();

        return [
            $this->kpi('approval_cycle', 'Waktu siklus Draft → Released', $avgCycle, 'hari',
                $avgCycle === null ? 'na' : ($avgCycle <= 14 ? 'ok' : ($avgCycle <= 30 ? 'warn' : 'bad')),
                $avgCycle === null ? 'Belum ada dokumen jalur approval yang berlaku pada periode ini.'
                    : "Rata-rata dari {$cycles->count()} dokumen yang berlaku pada periode ini (tidak termasuk dokumen hasil proyek penyusunan).", '≤ 14 hari'),
            $this->kpi('compliance_coverage', 'Cakupan kepatuhan klausul', $coverage, '%',
                $coverage === null ? 'na' : ($coverage >= 80 ? 'ok' : ($coverage >= 50 ? 'warn' : 'bad')),
                $totalClauses ? "{$coveredClauses} dari {$totalClauses} klausul punya minimal satu dokumen berstatus Compliant di Compliance Matrix."
                    : 'Belum ada klausul standar.', '≥ 80%'),
            $this->kpi('overdue_reviews', 'Dokumen lewat jadwal tinjau ulang', $overdue, 'dokumen',
                $overdue === 0 ? 'ok' : ($overdue <= 5 ? 'warn' : 'bad'), 'Dokumen Released yang tanggal tinjau ulangnya sudah lewat (kondisi saat ini).', '0'),
            $this->kpi('document_utilization', 'Pemanfaatan dokumen', $usage, 'akses',
                'info', 'Jumlah lihat/unduh berkas dokumen tercatat di audit trail pada periode ini.'),
            $this->na('distribution_ack', 'Kepatuhan distribusi (acknowledgement)', 'Belum terukur — modul Distribution Management/konfirmasi baca belum tersedia.'),
            $this->kpi('ai_adoption', 'Adopsi Asisten AI', $aiPct, '%',
                $aiPct === null ? 'na' : ($aiPct >= 50 ? 'ok' : ($aiPct >= 25 ? 'warn' : 'bad')),
                $aiTotal ? "{$aiUsed} dari {$aiTotal} hasil Asisten AI pada periode ini ditindaklanjuti menjadi permintaan penyusunan."
                    : 'Belum ada pemakaian Asisten AI pada periode ini.', '≥ 50%'),
            $this->kpi('drafting_trail', 'Kelengkapan jejak penyusunan', $this->pct($viaDrafting, $newDocs), '%',
                $newDocs === 0 ? 'na' : ($this->pct($viaDrafting, $newDocs) >= 80 ? 'ok' : ($this->pct($viaDrafting, $newDocs) >= 40 ? 'warn' : 'bad')),
                $newDocs ? "{$viaDrafting} dari {$newDocs} dokumen baru pada periode ini lahir dari proyek penyusunan yang disahkan." : 'Belum ada dokumen baru pada periode ini.', '≥ 80%'),
            $this->kpi('security_indicator', 'Indikator keamanan: login gagal & akun terkunci', $failedLogins, 'kejadian',
                $failedLogins <= 10 ? 'ok' : ($failedLogins <= 50 ? 'warn' : 'bad'),
                'Percobaan login gagal dan penguncian akun tercatat di audit trail — indikator dini, bukan jumlah insiden keamanan terkonfirmasi.'),
        ];
    }

    private function governanceKpis(Carbon $from, Carbon $to): array
    {
        $today = now()->toDateString();

        $raised = Finding::whereBetween('created_at', [$from, $to])->count();
        $closedOfRaised = Finding::whereBetween('created_at', [$from, $to])->where('status', 'closed')->count();
        $overdueFindings = Finding::whereNotIn('status', ['closed', 'rejected'])->whereNotNull('due_date')->whereDate('due_date', '<', $today)->count();

        $openRisks = Risk::where('status', '!=', 'closed')->count();
        $highRisks = Risk::where('status', '!=', 'closed')->whereIn('residual_level', ['high', 'extreme'])->count();

        $audits = Audit::whereDate('planned_start', '>=', $from->toDateString())->whereDate('planned_start', '<=', $to->toDateString())->where('status', '!=', 'cancelled');
        $auditTotal = (clone $audits)->count();
        $auditDone = (clone $audits)->where('status', 'completed')->count();

        $legalActive = LegalRequirement::where('status', 'active')->where('compliance_status', '!=', 'not_evaluated')->count();
        $legalOk = LegalRequirement::where('status', 'active')->where('compliance_status', 'compliant')->count();

        $mrActions = MgmtReviewAction::count();
        $mrDone = MgmtReviewAction::where('status', 'completed')->count();

        $recordsDue = Record::whereIn('status', ['active', 'inactive'])->where('legal_hold', false)->whereDate('inactive_until', '<=', $today)->count();

        $ratified = DraftingProject::where('status', 'ratified')->whereBetween('ratified_at', [$from, $to])->get(['created_at', 'ratified_at']);
        $lead = $ratified->isNotEmpty() ? round($ratified->avg(fn ($p) => $p->created_at->diffInDays($p->ratified_at)), 1) : null;

        $closure = $this->pct($closedOfRaised, $raised);
        $riskPct = $this->pct($highRisks, $openRisks);
        $auditPct = $this->pct($auditDone, $auditTotal);
        $legalPct = $this->pct($legalOk, $legalActive);
        $mrPct = $this->pct($mrDone, $mrActions);

        return [
            $this->kpi('capa_closure', 'Penutupan temuan/CAPA', $closure, '%',
                $closure === null ? 'na' : ($closure >= 80 ? 'ok' : ($closure >= 50 ? 'warn' : 'bad')),
                $raised ? "{$closedOfRaised} dari {$raised} temuan yang diangkat pada periode ini sudah ditutup." : 'Belum ada temuan pada periode ini.', '≥ 80%'),
            $this->kpi('capa_overdue', 'Temuan melewati tenggat', $overdueFindings, 'temuan',
                $overdueFindings === 0 ? 'ok' : ($overdueFindings <= 3 ? 'warn' : 'bad'), 'Temuan terbuka yang tenggatnya sudah lewat (kondisi saat ini).', '0'),
            $this->kpi('risk_high', 'Risiko residual tinggi/ekstrem', $riskPct, '%',
                $riskPct === null ? 'na' : ($riskPct <= 10 ? 'ok' : ($riskPct <= 25 ? 'warn' : 'bad')),
                $openRisks ? "{$highRisks} dari {$openRisks} risiko aktif berlevel residual tinggi/ekstrem." : 'Belum ada risiko aktif.', '≤ 10%'),
            $this->kpi('audit_programme', 'Realisasi program audit', $auditPct, '%',
                $auditPct === null ? 'na' : ($auditPct >= 90 ? 'ok' : ($auditPct >= 60 ? 'warn' : 'bad')),
                $auditTotal ? "{$auditDone} dari {$auditTotal} audit terjadwal pada periode ini sudah selesai." : 'Belum ada audit terjadwal pada periode ini.', '≥ 90%'),
            $this->kpi('legal_compliance', 'Kepatuhan peraturan', $legalPct, '%',
                $legalPct === null ? 'na' : ($legalPct >= 95 ? 'ok' : ($legalPct >= 80 ? 'warn' : 'bad')),
                $legalActive ? "{$legalOk} dari {$legalActive} peraturan berlaku yang sudah dievaluasi berstatus Patuh." : 'Belum ada peraturan yang dievaluasi.', '100%'),
            $this->kpi('mgmt_review_actions', 'Tindak lanjut tinjauan manajemen selesai', $mrPct, '%',
                $mrPct === null ? 'na' : ($mrPct >= 80 ? 'ok' : ($mrPct >= 50 ? 'warn' : 'bad')),
                $mrActions ? "{$mrDone} dari {$mrActions} tindak lanjut tinjauan manajemen sudah selesai." : 'Belum ada tindak lanjut tinjauan manajemen.', '≥ 80%'),
            $this->kpi('records_due', 'Rekaman jatuh tempo retensi', $recordsDue, 'rekaman',
                $recordsDue === 0 ? 'ok' : ($recordsDue <= 10 ? 'warn' : 'bad'), 'Rekaman yang masa retensinya habis dan belum dimusnahkan/diserahkan (di luar legal hold).', '0'),
            $this->kpi('drafting_lead_time', 'Lama penyusunan (permintaan → pengesahan)', $lead, 'hari',
                $lead === null ? 'na' : ($lead <= 30 ? 'ok' : ($lead <= 60 ? 'warn' : 'bad')),
                $lead === null ? 'Belum ada proyek penyusunan yang disahkan pada periode ini.' : "Rata-rata dari {$ratified->count()} proyek yang disahkan pada periode ini.", '≤ 30 hari'),
        ];
    }

    private function monthly(int $year): array
    {
        $months = array_fill(1, 12, ['released' => 0, 'findings' => 0, 'records' => 0]);
        $range = [Carbon::create($year, 1, 1)->toDateString(), Carbon::create($year, 12, 31)->toDateString()];

        foreach (Document::where('status', 'released')->whereDate('effective_date', '>=', $range[0])->whereDate('effective_date', '<=', $range[1])->pluck('effective_date') as $d) {
            $months[(int) $d->format('n')]['released']++;
        }
        foreach (Finding::whereBetween('created_at', [$range[0].' 00:00:00', $range[1].' 23:59:59'])->pluck('created_at') as $d) {
            $months[(int) $d->format('n')]['findings']++;
        }
        foreach (Record::whereDate('record_date', '>=', $range[0])->whereDate('record_date', '<=', $range[1])->pluck('record_date') as $d) {
            $months[(int) $d->format('n')]['records']++;
        }

        return collect($months)->map(fn ($v, $m) => ['month' => $m, ...$v])->values()->all();
    }

    private function cycleByStandard(Carbon $from, Carbon $to): array
    {
        $docs = Document::where('status', 'released')->whereNotNull('effective_date')
            ->whereDate('effective_date', '>=', $from->toDateString())->whereDate('effective_date', '<=', $to->toDateString())
            ->whereNotIn('id', $this->draftingDocumentIds())
            ->with('standards:code')->get(['id', 'created_at', 'effective_date']);

        $byStd = [];
        foreach ($docs as $d) {
            $days = max(0, $d->created_at->startOfDay()->diffInDays($d->effective_date, false));
            foreach ($d->standards as $s) {
                $byStd[$s->code][] = $days;
            }
        }

        return collect($byStd)->map(fn ($days, $code) => [
            'standard' => $code, 'documents' => count($days), 'avg_days' => round(array_sum($days) / count($days), 1),
        ])->sortBy('standard')->values()->all();
    }

    private function topDocuments(Carbon $from, Carbon $to): array
    {
        return AuditLog::whereIn('action', ['view', 'download'])->whereBetween('created_at', [$from, $to])
            ->whereNotNull('entity_label')
            ->selectRaw('entity_label as code, count(*) as hits')->groupBy('entity_label')
            ->orderByDesc('hits')->limit(5)->get()->toArray();
    }

    /** Cegah CSV/formula injection: sel teks yang diawali = + - @ tidak dieksekusi Excel sebagai rumus. */
    private static function csvCell(mixed $value): mixed
    {
        return is_string($value) && preg_match('/^[=+\-@\t\r]./s', $value) ? "'".$value : $value;
    }

}
