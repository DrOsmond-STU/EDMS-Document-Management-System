<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrgFunction;
use App\Models\Standard;
use App\Models\StandardClause;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Master Data — kelola daftar acuan bersama (fungsi/departemen & standar)
 * yang dirujuk lintas modul: nomor dokumen (SOP-{function}-001), Register
 * Dokumen, Compliance Matrix, dsb. index() tetap publik untuk semua peran
 * berautentikasi (dipakai dropdown formulir Buat Dokumen oleh siapa pun
 * yang boleh membuat dokumen) — method lain di bawah ini yang mengelola
 * data (tambah/ubah) dibatasi masterdata.manage.
 *
 * Sengaja TIDAK ADA hapus, hanya nonaktifkan (`active=false`) — sama
 * seperti pola Document & User: id/kode sudah tertanam permanen di nomor
 * dokumen yang sudah terbit (mis. SOP-QA-001) dan direferensikan sebagai
 * foreign key, jadi menghapusnya akan merusak riwayat. id/kode juga tidak
 * bisa diubah setelah dibuat — mengganti kode fungsi/standar setelah
 * dipakai bakal membuat nomor dokumen lama tidak lagi masuk akal.
 */
class MasterDataController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    /** Data acuan untuk dropdown formulir — fungsi & standar aktif saja. */
    public function index(): JsonResponse
    {
        return response()->json([
            'functions' => OrgFunction::where('active', true)->orderBy('name')->get(['id', 'name']),
            'standards' => Standard::where('active', true)->orderBy('code')->get(['code', 'name']),
            // id+nama saja (bukan email/peran) — dipakai untuk dropdown penunjukan
            // penanggung jawab (mis. lead auditor, pemilik risiko berakun) lintas modul.
            'users' => User::where('active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function functions(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }

        return response()->json(
            OrgFunction::withCount(['documents', 'users'])->orderBy('name')->get()
        );
    }

    public function storeFunction(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'id' => ['required', 'string', 'max:32', 'regex:/^[a-z][a-z0-9_]*$/', 'unique:org_functions,id'],
            'name' => ['required', 'string', 'max:255'],
            'active' => ['sometimes', 'boolean'],
        ], [
            'id.regex' => 'Kode harus huruf kecil, diawali huruf, boleh berisi angka/garis bawah (mis. "qa", "hsse_02").',
        ]);

        $function = OrgFunction::create([
            'id' => $data['id'],
            'name' => $data['name'],
            'active' => $data['active'] ?? true,
        ]);

        $this->audit->log($request->user(), 'create', 'OrgFunction', $function->id, $function->name,
            "Menambahkan fungsi/departemen \"{$function->name}\" ({$function->id}).");

        return response()->json($function, 201);
    }

    public function updateFunction(Request $request, string $orgFunction): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }

        $function = OrgFunction::findOrFail($orgFunction);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'active' => ['sometimes', 'boolean'],
        ]);

        $function->fill($data)->save();

        $this->audit->log($request->user(), 'update', 'OrgFunction', $function->id, $function->name,
            "Memperbarui fungsi/departemen \"{$function->name}\" ({$function->id}).");

        return response()->json($function->fresh());
    }

    public function standards(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }

        return response()->json(
            Standard::withCount(['documents', 'clauses'])->orderBy('code')->get()
        );
    }

    public function storeStandard(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'code' => ['required', 'string', 'max:32', 'regex:/^[A-Za-z][A-Za-z0-9_\-]*$/', 'unique:standards,code'],
            'name' => ['required', 'string', 'max:255'],
            'active' => ['sometimes', 'boolean'],
        ], [
            'code.regex' => 'Kode harus diawali huruf, boleh berisi huruf/angka/garis bawah/strip (mis. "ISO9001").',
        ]);

        $standard = Standard::create([
            'code' => $data['code'],
            'name' => $data['name'],
            'active' => $data['active'] ?? true,
        ]);

        $this->audit->log($request->user(), 'create', 'Standard', $standard->code, $standard->name,
            "Menambahkan standar \"{$standard->name}\" ({$standard->code}).");

        return response()->json($standard, 201);
    }

    public function updateStandard(Request $request, string $standard): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }

        $model = Standard::findOrFail($standard);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'active' => ['sometimes', 'boolean'],
        ]);

        $model->fill($data)->save();

        $this->audit->log($request->user(), 'update', 'Standard', $model->code, $model->name,
            "Memperbarui standar \"{$model->name}\" ({$model->code}).");

        return response()->json($model->fresh());
    }

    /**
     * Master data dihapus sungguhan HANYA bila tidak dipakai di mana pun
     * (termasuk data yang sudah dihapus lunak) — kalau masih dipakai,
     * nonaktifkan saja supaya riwayat tetap utuh.
     */
    public function destroyFunction(Request $request, string $orgFunction): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }
        $function = OrgFunction::findOrFail($orgFunction);

        $used = collect(['documents', 'users', 'risks', 'findings', 'audits', 'drafting_projects', 'record_series', 'legal_requirements'])
            ->sum(fn ($table) => DB::table($table)->where('function_id', $function->id)->count());
        if ($used > 0) {
            return response()->json(['message' => "Fungsi \"{$function->name}\" masih dipakai {$used} data (dokumen, pengguna, risiko, dll.). Nonaktifkan saja agar tidak muncul di pilihan baru."], 422);
        }

        $function->delete();
        $this->audit->log($request->user(), 'delete', 'OrgFunction', $function->id, $function->name,
            "Menghapus fungsi/departemen \"{$function->name}\" ({$function->id}).");

        return response()->json(['message' => 'Fungsi dihapus.']);
    }

    public function destroyStandard(Request $request, string $standard): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }
        $model = Standard::findOrFail($standard);

        $used = collect(['document_standard', 'risk_standard', 'finding_standard', 'audit_standard', 'drafting_project_standard'])
            ->sum(fn ($table) => DB::table($table)->where('standard_code', $model->code)->count())
            + DB::table('clause_assessments')->whereIn('clause_id', DB::table('standard_clauses')->where('standard_code', $model->code)->select('id'))->count();
        if ($used > 0) {
            return response()->json(['message' => "Standar {$model->code} masih dipakai {$used} data (dokumen, risiko, temuan, audit, penilaian klausul, dll.). Nonaktifkan saja agar tidak muncul di pilihan baru."], 422);
        }

        DB::transaction(function () use ($model) {
            DB::table('standard_clauses')->where('standard_code', $model->code)->delete();
            $model->delete();
        });
        $this->audit->log($request->user(), 'delete', 'Standard', $model->code, $model->name,
            "Menghapus standar \"{$model->name}\" ({$model->code}) beserta taksonomi klausulnya.");

        return response()->json(['message' => 'Standar dihapus.']);
    }

    // ---- Klausul standar (taksonomi Compliance Matrix) -----------------

    public function clauses(Request $request, string $standard): JsonResponse
    {
        if (! $this->canManageClauses($request)) {
            return $this->forbidden();
        }
        $model = Standard::findOrFail($standard);

        return response()->json([
            'standard' => $model->only(['code', 'name']),
            'clauses' => StandardClause::where('standard_code', $model->code)->withCount('assessments')
                ->orderBy('sort_order')->orderBy('code')->get(['id', 'standard_code', 'code', 'title', 'sort_order']),
        ]);
    }

    public function storeClause(Request $request, string $standard): JsonResponse
    {
        if (! $this->canManageClauses($request)) {
            return $this->forbidden();
        }
        $model = Standard::findOrFail($standard);
        $data = $request->validate([
            'code' => ['required', 'string', 'max:32', Rule::unique('standard_clauses', 'code')->where('standard_code', $model->code)],
            'title' => ['required', 'string', 'max:255'],
            'sort_order' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000'],
        ], ['code.unique' => 'Nomor klausul ini sudah ada pada standar tersebut.']);

        $clause = StandardClause::create([
            'standard_code' => $model->code, 'code' => $data['code'], 'title' => $data['title'],
            'sort_order' => $data['sort_order'] ?? ((int) StandardClause::where('standard_code', $model->code)->max('sort_order') + 1),
        ]);
        $this->audit->log($request->user(), 'create', 'StandardClause', "{$model->code} {$clause->code}", $clause->title,
            "Menambah klausul {$model->code} {$clause->code} \"{$clause->title}\".");

        return response()->json($clause, 201);
    }

    public function updateClause(Request $request, string $standard, StandardClause $clause): JsonResponse
    {
        if (! $this->canManageClauses($request)) {
            return $this->forbidden();
        }
        abort_unless($clause->standard_code === $standard, 404);
        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:32', Rule::unique('standard_clauses', 'code')->where('standard_code', $standard)->ignore($clause->id)],
            'title' => ['sometimes', 'string', 'max:255'],
            'sort_order' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000'],
        ], ['code.unique' => 'Nomor klausul ini sudah ada pada standar tersebut.']);
        $clause->update($data);
        $this->audit->log($request->user(), 'update', 'StandardClause', "{$standard} {$clause->code}", $clause->title,
            "Mengubah klausul {$standard} {$clause->code}.");

        return response()->json($clause->fresh());
    }

    public function destroyClause(Request $request, string $standard, StandardClause $clause): JsonResponse
    {
        if (! $this->canManageClauses($request)) {
            return $this->forbidden();
        }
        abort_unless($clause->standard_code === $standard, 404);
        $used = DB::table('clause_assessments')->where('clause_id', $clause->id)->count();
        if ($used > 0) {
            return response()->json(['message' => "Klausul ini sudah punya {$used} penilaian di Compliance Matrix — hapus penilaiannya dulu, atau ubah saja judulnya."], 422);
        }
        $clause->delete();
        $this->audit->log($request->user(), 'delete', 'StandardClause', "{$standard} {$clause->code}", $clause->title,
            "Menghapus klausul {$standard} {$clause->code} \"{$clause->title}\".");

        return response()->json(['message' => 'Klausul dihapus.']);
    }

    /** Taksonomi klausul dikelola admin master data maupun Compliance & Risk Admin. */
    private function canManageClauses(Request $request): bool
    {
        return $this->authorized($request) || $request->user()->hasPermission(Permissions::COMPLIANCE_MANAGE);
    }

    private function authorized(Request $request): bool
    {
        return $request->user()->hasPermission(Permissions::MASTERDATA_MANAGE);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['message' => 'Anda tidak berwenang mengelola master data.'], 403);
    }
}
