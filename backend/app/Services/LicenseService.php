<?php

namespace App\Services;

use App\Models\License;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

/**
 * Satu-satunya jalur penulisan & pemeriksaan lisensi. Tanda tangan HMAC
 * memastikan baris `licenses` tidak bisa dipalsukan hanya dengan menulis
 * langsung ke database — nilainya harus cocok dengan hasil hitung ulang
 * memakai secret yang hanya diketahui EDMS ini dan tool vendor eksternal.
 */
class LicenseService
{
    public function signaturePayload(string $licenseKey, string $expiresAt, string $status): string
    {
        return "{$licenseKey}|{$expiresAt}|{$status}";
    }

    public function computeSignature(string $licenseKey, string $expiresAt, string $status): string
    {
        $secret = config('license.signing_secret');
        if (! $secret) {
            throw new InvalidArgumentException('LICENSE_SIGNING_SECRET belum diatur di server ini.');
        }

        return hash_hmac('sha256', $this->signaturePayload($licenseKey, $expiresAt, $status), $secret);
    }

    /** Terapkan pembaruan lisensi. Pemanggil (controller) sudah wajib memverifikasi signature dari request SEBELUM sampai sini. */
    public function apply(string $licenseKey, string $expiresAt, string $status): License
    {
        $license = License::current();

        $license->license_key = $licenseKey;
        $license->expires_at = $expiresAt;
        $license->status = $status;
        $license->signature = $this->computeSignature($licenseKey, $expiresAt, $status);
        if (! $license->activated_at && $status === 'active') {
            $license->activated_at = now()->toDateString();
        }
        $license->save();

        return $license;
    }

    /**
     * Valid HANYA jika: statusnya "active", belum lewat expires_at, DAN
     * tanda tangan yang tersimpan cocok dengan hitungan ulang dari field-nya
     * sendiri. Cocok berarti baris ini benar berasal dari tool vendor —
     * kalau seseorang mengubah expires_at langsung di database, tanda
     * tangan lama tidak akan cocok lagi dengan payload yang baru.
     */
    public function isValid(): bool
    {
        $license = License::current();

        if ($license->status !== 'active' || ! $license->license_key || ! $license->expires_at) {
            return false;
        }

        if (Carbon::parse($license->expires_at)->isPast()) {
            return false;
        }

        $expected = $this->computeSignature(
            $license->license_key,
            $license->expires_at->toDateString(),
            $license->status,
        );

        return hash_equals($expected, (string) $license->signature);
    }

    /** Ringkasan aman untuk ditampilkan ke klien — tanpa signature, kunci disamarkan. */
    public function publicStatus(): array
    {
        $license = License::current();
        $valid = $this->isValid();

        return [
            'valid' => $valid,
            'status' => $license->status,
            'license_key_masked' => $this->maskKey($license->license_key),
            'expires_at' => $license->expires_at?->toDateString(),
            'activated_at' => $license->activated_at?->toDateString(),
            'message' => $valid
                ? null
                : 'Lisensi tidak aktif atau sudah kedaluwarsa. Hubungi penyedia layanan untuk memperbarui.',
        ];
    }

    private function maskKey(?string $key): ?string
    {
        if (! $key) {
            return null;
        }
        $tail = substr($key, -4);

        return str_repeat('•', max(strlen($key) - 4, 0)).$tail;
    }
}
