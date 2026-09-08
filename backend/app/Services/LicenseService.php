<?php

namespace App\Services;

use App\Models\CompanySetting;
use App\Models\License;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

/**
 * Satu-satunya jalur penulisan & pemeriksaan lisensi. Tanda tangan HMAC
 * memastikan baris `licenses` tidak bisa dipalsukan hanya dengan menulis
 * langsung ke database — nilainya harus cocok dengan hasil hitung ulang
 * memakai secret yang hanya diketahui EDMS ini dan tool vendor eksternal.
 *
 * Nama & alamat perusahaan SENGAJA ikut ditandatangani (bukan hanya
 * license_key/expires_at/status) — supaya seluruh salinan kode + database
 * ini TIDAK BISA disalin ke server lain lalu diganti nama perusahaannya
 * lewat Pengaturan Perusahaan untuk dijual ulang ke klien lain: begitu
 * nama/alamat berubah tapi tanda tangannya tidak (karena hanya tool vendor
 * yang tahu secret-nya), lisensi langsung dianggap tidak valid dan seluruh
 * aplikasi terkunci. Karena itu company_settings.name/address TIDAK LAGI
 * bisa diubah lewat CompanySettingController — hanya lewat sini.
 */
class LicenseService
{
    public function signaturePayload(string $licenseKey, string $expiresAt, string $status, string $companyName, string $companyAddress): string
    {
        return "{$licenseKey}|{$expiresAt}|{$status}|{$companyName}|{$companyAddress}";
    }

    public function computeSignature(string $licenseKey, string $expiresAt, string $status, string $companyName, string $companyAddress): string
    {
        $secret = config('license.signing_secret');
        if (! $secret) {
            throw new InvalidArgumentException('LICENSE_SIGNING_SECRET belum diatur di server ini.');
        }

        return hash_hmac('sha256', $this->signaturePayload($licenseKey, $expiresAt, $status, $companyName, $companyAddress), $secret);
    }

    /** Terapkan pembaruan lisensi SEKALIGUS identitas perusahaan. Pemanggil (controller) sudah wajib memverifikasi signature dari request SEBELUM sampai sini. */
    public function apply(string $licenseKey, string $expiresAt, string $status, string $companyName, string $companyAddress): License
    {
        $license = License::current();

        $license->license_key = $licenseKey;
        $license->expires_at = $expiresAt;
        $license->status = $status;
        $license->signature = $this->computeSignature($licenseKey, $expiresAt, $status, $companyName, $companyAddress);
        if (! $license->activated_at && $status === 'active') {
            $license->activated_at = now()->toDateString();
        }
        $license->save();

        $setting = CompanySetting::current();
        $setting->name = $companyName;
        $setting->address = $companyAddress;
        $setting->save();

        return $license;
    }

    /**
     * Valid HANYA jika: statusnya "active", belum lewat expires_at, DAN
     * tanda tangan yang tersimpan cocok dengan hitungan ulang dari field
     * lisensi DIGABUNG dengan nama/alamat perusahaan yang tersimpan SAAT
     * INI. Kalau salah satunya diubah lewat cara apa pun selain apply() di
     * atas (mis. baris company_settings diedit langsung di database, atau
     * seluruh database disalin ke server lain lalu namanya diganti), tanda
     * tangan lama tidak akan cocok lagi dan lisensi otomatis tidak valid.
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

        $setting = CompanySetting::current();
        $expected = $this->computeSignature(
            $license->license_key,
            $license->expires_at->toDateString(),
            $license->status,
            $setting->name ?? '',
            $setting->address ?? '',
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
