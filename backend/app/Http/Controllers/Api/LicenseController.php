<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use App\Services\LicenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class LicenseController extends Controller
{
    public function __construct(private LicenseService $license, private AuditLogger $audit) {}

    /** Publik, dan SENGAJA di luar middleware license.active — frontend perlu ini untuk menampilkan layar blokir. */
    public function status(): JsonResponse
    {
        return response()->json($this->license->publicStatus());
    }

    /**
     * Satu-satunya jalur untuk MENGUBAH lisensi. Tidak ada sesi/permission
     * pengguna di sini — ini dipanggil oleh tool vendor eksternal (di luar
     * EDMS), diautentikasi lewat tanda tangan HMAC yang dihitung dari
     * secret yang hanya diketahui kedua sisi. Sengaja di luar middleware
     * license.active juga: lisensi yang sudah kedaluwarsa harus tetap bisa
     * diperbarui lewat sini.
     */
    public function apply(Request $request): JsonResponse
    {
        $data = $request->validate([
            'license_key' => ['required', 'string', 'max:255'],
            'expires_at' => ['required', 'date'],
            'status' => ['required', Rule::in(['active', 'suspended', 'revoked'])],
            'company_name' => ['required', 'string', 'max:255'],
            'company_address' => ['nullable', 'string', 'max:1000'],
            'signature' => ['required', 'string'],
        ]);

        $expiresAt = Carbon::parse($data['expires_at'])->toDateString();
        $companyAddress = $data['company_address'] ?? '';
        $expected = $this->license->computeSignature(
            $data['license_key'], $expiresAt, $data['status'], $data['company_name'], $companyAddress,
        );

        if (! hash_equals($expected, $data['signature'])) {
            Log::warning('Percobaan pembaruan lisensi dengan tanda tangan tidak valid', ['ip' => $request->ip()]);

            return response()->json(['message' => 'Tanda tangan tidak valid.'], 403);
        }

        $license = $this->license->apply(
            $data['license_key'], $expiresAt, $data['status'], $data['company_name'], $companyAddress,
        );

        $this->audit->log(null, 'update', 'License', '1', $license->license_key,
            "Lisensi & identitas perusahaan diperbarui oleh tool vendor eksternal — status: {$license->status}, berlaku s/d {$expiresAt}, nama: {$data['company_name']}.");

        return response()->json($this->license->publicStatus());
    }
}
