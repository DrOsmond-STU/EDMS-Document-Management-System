<?php

namespace App\Services;

use App\Models\IntegrationSetting;
use App\Support\OutboundHostGuard;
use Illuminate\Support\Facades\Log;

/**
 * Menyiapkan mailer runtime dari pengaturan Integration & API → Email/SMTP,
 * supaya fitur seperti reminder tinjauan ulang dokumen benar-benar terkirim
 * lewat SMTP yang dikonfigurasi admin — bukan cuma tersimpan di database
 * tanpa dipakai. Mengembalikan null kalau integrasi belum diaktifkan atau
 * belum lengkap, supaya pemanggil bisa berhenti dengan pesan yang jelas
 * alih-alih gagal diam-diam.
 */
class IntegrationMailerFactory
{
    public function smtpMailerName(): ?string
    {
        $setting = IntegrationSetting::forType('smtp');
        if (! $setting->enabled) {
            return null;
        }

        $host = $setting->value('host');
        $fromAddress = $setting->value('from_address');
        if (! $host || ! $fromAddress) {
            return null;
        }
        // Diperiksa lagi saat benar-benar mengirim (DNS bisa berubah setelah disimpan).
        $port = (int) ($setting->value('port') ?: 587);
        if ($blocked = app(OutboundHostGuard::class)->check($host, $port, OutboundHostGuard::SMTP_PORTS)) {
            Log::warning('Pengiriman email via integrasi SMTP diblokir', ['host' => $host, 'reason' => $blocked]);

            return null;
        }

        config(['mail.mailers.integration_smtp' => [
            'transport' => 'smtp',
            'host' => $host,
            'port' => $port,
            'encryption' => $setting->value('encryption') === 'tls' ? 'tls' : null,
            'username' => $setting->value('username') ?: null,
            'password' => $setting->secrets['password'] ?? null,
            'timeout' => 15,
        ]]);

        config(['mail.from' => [
            'address' => $fromAddress,
            'name' => $setting->value('from_name') ?: 'EDMS',
        ]]);

        return 'integration_smtp';
    }
}
