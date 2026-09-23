<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Record;
use App\Models\RecordSeries;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Records Register + aksi retensi (pindah inaktif, penahanan legal,
 * pemusnahan, penyerahan permanen). Pemusnahan & penyerahan permanen
 * memakai izin tersendiri (records.dispose) karena tidak bisa dibatalkan,
 * dan hanya boleh setelah masa retensi JRA benar-benar habis.
 */
class RecordController extends Controller
{
    private const MEDIUMS = ['physical', 'electronic', 'hybrid'];
    private const CLASSIFICATIONS = ['public', 'internal', 'confidential', 'secret'];
    private const STATUSES = ['active', 'inactive', 'destroyed', 'archived_permanent'];
    private const DUE_FILTERS = ['to_inactive', 'to_dispose', 'on_hold'];

    public function __construct(private AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::RECORDS_VIEW)) {
            return response()->json(['message' => 'Anda tidak berwenang melihat Records Register.'], 403);
        }

        $query = Record::query()->with(['series:id,code,name,disposition', 'orgFunction:id,name', 'document:id,code,title', 'disposer:id,name']);

        if ($q = trim((string) $request->string('q'))) {
            $query->where(fn ($w) => $w
                ->where('title', 'like', "%{$q}%")
                ->orWhere('code', 'like', "%{$q}%")
                ->orWhere('location', 'like', "%{$q}%"));
        }
        foreach (['series_id', 'status', 'function_id', 'medium'] as $filter) {
            if ($value = $request->string($filter)->toString()) {
                $query->where($filter, $value);
            }
        }
        if (in_array($due = $request->string('due')->toString(), self::DUE_FILTERS, true)) {
            $this->applyDue($query, $due);
        }

        return response()->json([
            'records' => $query->orderByDesc('record_date')->orderByDesc('id')->get(),
            'stats' => [
                'active' => Record::where('status', 'active')->count(),
                'inactive' => Record::where('status', 'inactive')->count(),
                'destroyed' => Record::where('status', 'destroyed')->count(),
                'archived_permanent' => Record::where('status', 'archived_permanent')->count(),
                'due_to_inactive' => $this->applyDue(Record::query(), 'to_inactive')->count(),
                'due_to_dispose' => $this->applyDue(Record::query(), 'to_dispose')->count(),
                'on_hold' => $this->applyDue(Record::query(), 'on_hold')->count(),
            ],
            'meta' => ['mediums' => self::MEDIUMS, 'classifications' => self::CLASSIFICATIONS, 'statuses' => self::STATUSES],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::RECORDS_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang menambah rekaman.'], 403);
        }

        $data = $this->validateRecord($request);
        $series = RecordSeries::findOrFail($data['series_id']);
        if (! $series->active) {
            return response()->json(['message' => 'Seri rekaman ini sudah dinonaktifkan di Jadwal Retensi.'], 422);
        }

        $record = DB::transaction(fn () => Record::create([
            'code' => Record::nextCode(),
            'status' => 'active',
            'created_by' => $request->user()->id,
            ...$data,
            ...Record::retentionDates($data['record_date'], $series),
        ]));

        $this->audit->log($request->user(), 'create', 'Record', $record->code, $record->title,
            "Mendaftarkan rekaman \"{$record->title}\" ({$record->code}) pada seri {$series->code}.");

        return response()->json($this->present($record), 201);
    }

    public function update(Request $request, Record $record): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::RECORDS_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang mengubah rekaman.'], 403);
        }
        if (in_array($record->status, Record::FINAL_STATUSES, true)) {
            return response()->json(['message' => 'Rekaman yang sudah dimusnahkan/diserahkan permanen tidak bisa diubah.'], 422);
        }

        $data = $this->validateRecord($request, sometimes: true);
        $record->fill($data);
        if ($record->isDirty(['record_date', 'series_id'])) {
            $record->fill(Record::retentionDates($record->record_date, RecordSeries::findOrFail($record->series_id)));
        }
        $record->save();

        $this->audit->log($request->user(), 'update', 'Record', $record->code, $record->title,
            "Memperbarui rekaman \"{$record->title}\" ({$record->code}).");

        return response()->json($this->present($record->fresh()));
    }

    /**
     * Hapus = salah input. Rekaman berstatus akhir (dimusnahkan/permanen)
     * adalah bukti disposisi dan rekaman dalam legal hold wajib dijaga —
     * keduanya tidak boleh dihapus.
     */
    public function destroy(Request $request, Record $record): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::RECORDS_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang menghapus rekaman.'], 403);
        }
        if (in_array($record->status, Record::FINAL_STATUSES, true)) {
            return response()->json(['message' => 'Rekaman yang sudah dimusnahkan/diserahkan permanen adalah bukti disposisi dan tidak bisa dihapus.'], 422);
        }
        if ($record->legal_hold) {
            return response()->json(['message' => 'Rekaman sedang dalam legal hold — lepaskan hold terlebih dahulu.'], 422);
        }

        $record->delete();
        $this->audit->log($request->user(), 'delete', 'Record', $record->code, $record->title,
            "Menghapus rekaman \"{$record->title}\" ({$record->code}).");

        return response()->json(['message' => 'Rekaman dihapus.']);
    }

    public function action(Request $request, Record $record): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::RECORDS_MANAGE) && ! $request->user()->hasPermission(Permissions::RECORDS_DISPOSE)) {
            return response()->json(['message' => 'Anda tidak berwenang melakukan aksi ini.'], 403);
        }
        $data = $request->validate([
            'action' => ['required', 'string', Rule::in(['deactivate', 'hold', 'release', 'dispose', 'archive_permanent'])],
            'reason' => ['nullable', 'string', 'max:255'],
            'disposal_reference' => ['nullable', 'string', 'max:255'],
        ]);
        $action = $data['action'];
        $user = $request->user();

        $needed = in_array($action, ['dispose', 'archive_permanent'], true) ? Permissions::RECORDS_DISPOSE : Permissions::RECORDS_MANAGE;
        if (! $user->hasPermission($needed)) {
            return response()->json(['message' => 'Anda tidak berwenang melakukan aksi ini.'], 403);
        }
        if (in_array($record->status, Record::FINAL_STATUSES, true)) {
            return response()->json(['message' => 'Rekaman sudah berstatus akhir (musnah/permanen).'], 422);
        }

        $fail = fn (string $msg) => response()->json(['message' => $msg], 422);
        $today = now()->toDateString();

        switch ($action) {
            case 'deactivate':
                if ($record->status !== 'active') {
                    return $fail('Hanya rekaman aktif yang bisa dipindah ke inaktif.');
                }
                $record->status = 'inactive';
                $detail = 'Memindahkan rekaman ke arsip inaktif';
                break;

            case 'hold':
                if (! ($data['reason'] ?? null)) {
                    return $fail('Alasan penahanan legal wajib diisi.');
                }
                $record->legal_hold = true;
                $record->legal_hold_reason = $data['reason'];
                $detail = "Menahan rekaman (legal hold): {$data['reason']}";
                break;

            case 'release':
                $record->legal_hold = false;
                $record->legal_hold_reason = null;
                $detail = 'Mencabut penahanan legal rekaman';
                break;

            default: // dispose / archive_permanent
                if ($record->legal_hold) {
                    return $fail('Rekaman sedang dalam penahanan legal — cabut penahanan terlebih dahulu.');
                }
                if ($record->inactive_until->toDateString() > $today) {
                    return $fail("Masa retensi belum habis (jatuh tempo {$record->inactive_until->toDateString()}).");
                }
                $disposition = $record->series->disposition;
                if ($action === 'dispose' && $disposition === 'permanent') {
                    return $fail('Seri ini berketerangan PERMANEN di JRA — tidak boleh dimusnahkan.');
                }
                if ($action === 'archive_permanent' && $disposition === 'destroy') {
                    return $fail('Seri ini berketerangan MUSNAH di JRA — bukan untuk diserahkan permanen.');
                }
                if (! ($data['disposal_reference'] ?? null)) {
                    return $fail('Nomor berita acara wajib diisi.');
                }
                $record->status = $action === 'dispose' ? 'destroyed' : 'archived_permanent';
                $record->disposed_at = $today;
                $record->disposal_reference = $data['disposal_reference'];
                $record->disposed_by = $user->id;
                $detail = ($action === 'dispose' ? 'Memusnahkan' : 'Menyerahkan permanen')." rekaman (BA {$data['disposal_reference']})";
        }

        $record->save();

        $this->audit->log($user, 'update', 'Record', $record->code, $record->title, "{$detail} \"{$record->title}\" ({$record->code}).");

        return response()->json($this->present($record->fresh()));
    }

    private function applyDue(Builder $query, string $due): Builder
    {
        $today = now()->toDateString();

        return match ($due) {
            'to_inactive' => $query->where('status', 'active')->whereDate('active_until', '<=', $today),
            'to_dispose' => $query->whereIn('status', ['active', 'inactive'])->where('legal_hold', false)->whereDate('inactive_until', '<=', $today),
            'on_hold' => $query->whereNotIn('status', Record::FINAL_STATUSES)->where('legal_hold', true),
        };
    }

    private function validateRecord(Request $request, bool $sometimes = false): array
    {
        $rule = fn (array $rules) => $sometimes ? array_merge(['sometimes'], $rules) : $rules;

        return $request->validate([
            'series_id' => $rule(['required', 'integer', 'exists:record_series,id']),
            'title' => $rule(['required', 'string', 'max:255']),
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'record_date' => $rule(['required', 'date', 'before_or_equal:today']),
            'function_id' => ['sometimes', 'nullable', 'string', 'exists:org_functions,id'],
            'medium' => $rule(['required', 'string', Rule::in(self::MEDIUMS)]),
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'classification' => ['sometimes', 'string', Rule::in(self::CLASSIFICATIONS)],
            'document_id' => ['sometimes', 'nullable', 'integer', 'exists:documents,id'],
        ]);
    }

    private function present(Record $record): Record
    {
        return $record->load(['series:id,code,name,disposition', 'orgFunction:id,name', 'document:id,code,title', 'disposer:id,name']);
    }
}
