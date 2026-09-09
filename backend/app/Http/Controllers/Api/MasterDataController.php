<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrgFunction;
use App\Models\Standard;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            Standard::withCount('documents')->orderBy('code')->get()
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

    private function authorized(Request $request): bool
    {
        return $request->user()->hasPermission(Permissions::MASTERDATA_MANAGE);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['message' => 'Anda tidak berwenang mengelola master data.'], 403);
    }
}
