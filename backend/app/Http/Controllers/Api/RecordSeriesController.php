<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Record;
use App\Models\RecordSeries;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Jadwal Retensi Arsip (JRA) — seri rekaman beserta masa retensi aktif,
 * inaktif, dan keterangan akhirnya. Tidak ada hapus (nonaktifkan saja),
 * karena seri dirujuk oleh rekaman yang sudah ada. Kode tidak bisa diubah.
 */
class RecordSeriesController extends Controller
{
    private const DISPOSITIONS = ['destroy', 'permanent', 'review'];

    public function __construct(private AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::RECORDS_VIEW)) {
            return response()->json(['message' => 'Anda tidak berwenang melihat Jadwal Retensi.'], 403);
        }

        return response()->json([
            'series' => RecordSeries::with('orgFunction:id,name')->withCount('records')->orderBy('code')->get(),
            'meta' => ['dispositions' => self::DISPOSITIONS],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::RECORDS_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang mengelola Jadwal Retensi.'], 403);
        }

        $data = $request->validate([
            'code' => ['required', 'string', 'max:32', 'regex:/^[A-Z0-9][A-Z0-9.\-]*$/', 'unique:record_series,code'],
            ...$this->rules(),
        ]);

        $series = RecordSeries::create(['active' => true, ...$data]);

        $this->audit->log($request->user(), 'create', 'RecordSeries', $series->code, $series->name,
            "Menambahkan seri rekaman \"{$series->name}\" ({$series->code}) ke Jadwal Retensi.");

        return response()->json($series->load('orgFunction:id,name')->loadCount('records'), 201);
    }

    public function update(Request $request, RecordSeries $recordSeries): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::RECORDS_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang mengelola Jadwal Retensi.'], 403);
        }

        $data = $request->validate([...$this->rules(sometimes: true), 'active' => ['sometimes', 'boolean']]);

        $recomputed = DB::transaction(function () use ($recordSeries, $data) {
            $recordSeries->fill($data)->save();

            if (! $recordSeries->wasChanged(['retention_active_years', 'retention_inactive_years'])) {
                return 0;
            }

            // JRA yang berlaku adalah JRA terkini — rekaman yang belum
            // selesai (bukan musnah/permanen) ikut dihitung ulang jatuh temponya.
            $records = $recordSeries->records()->whereNotIn('status', Record::FINAL_STATUSES)->get();
            foreach ($records as $record) {
                $record->update(Record::retentionDates($record->record_date, $recordSeries));
            }

            return $records->count();
        });

        $this->audit->log($request->user(), 'update', 'RecordSeries', $recordSeries->code, $recordSeries->name,
            "Memperbarui seri rekaman \"{$recordSeries->name}\" ({$recordSeries->code})"
            .($recomputed ? "; jatuh tempo {$recomputed} rekaman dihitung ulang." : '.'));

        return response()->json($recordSeries->fresh()->load('orgFunction:id,name')->loadCount('records'));
    }

    private function rules(bool $sometimes = false): array
    {
        $rule = fn (array $rules) => $sometimes ? array_merge(['sometimes'], $rules) : $rules;

        return [
            'name' => $rule(['required', 'string', 'max:255']),
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'function_id' => ['sometimes', 'nullable', 'string', 'exists:org_functions,id'],
            'retention_active_years' => $rule(['required', 'integer', 'min:0', 'max:100']),
            'retention_inactive_years' => $rule(['required', 'integer', 'min:0', 'max:100']),
            'disposition' => $rule(['required', 'string', Rule::in(self::DISPOSITIONS)]),
            'legal_basis' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
