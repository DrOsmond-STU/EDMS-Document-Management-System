<?php

namespace App\Support;

/**
 * Penjaga koneksi keluar untuk integrasi yang host-nya diisi administrator
 * aplikasi (SMTP, LDAP). Tanpa ini, fitur "Uji Koneksi" bisa dipakai untuk
 * menjangkau jaringan internal server (SSRF: memindai port, menyentuh
 * layanan metadata cloud 169.254.169.254, database lokal, dsb.).
 *
 * Aturan:
 * - host harus nama host / alamat IP yang sah (tanpa skema, path, spasi),
 *   bukan localhost;
 * - SEMUA alamat hasil resolusi DNS wajib alamat internet publik
 *   (FILTER_FLAG_GLOBAL_RANGE menolak privat, loopback, link-local,
 *   CGNAT, dokumentasi, multicast, dan blok cadangan lainnya);
 * - port wajib termasuk daftar port layanan tersebut;
 * - server internal yang memang sah (mis. Active Directory kantor) hanya
 *   bisa dibuka lewat INTEGRATION_PRIVATE_HOSTS di .env server — artinya
 *   perlu pengelola server, bukan cukup admin aplikasi.
 */
class OutboundHostGuard
{
    public const SMTP_PORTS = [25, 465, 587, 2525];

    public const LDAP_PORTS = [389, 636, 3268, 3269];

    /** @return string|null pesan penolakan, atau null bila boleh */
    public function check(?string $host, int $port, array $allowedPorts): ?string
    {
        $host = strtolower(trim((string) $host));
        if ($host === '') {
            return 'Host wajib diisi.';
        }
        if (! in_array($port, $allowedPorts, true)) {
            return 'Port '.$port.' tidak diizinkan. Gunakan salah satu: '.implode(', ', $allowedPorts).'.';
        }

        $isIp = filter_var($host, FILTER_VALIDATE_IP) !== false;
        $allowlisted = in_array($host, $this->privateAllowlist(), true);
        // Nama satu kata (mis. "ldap") hanya sah bila dibuka eksplisit oleh pengelola server.
        if (! $isIp && ! $this->isHostname($host, requireDot: ! $allowlisted)) {
            return 'Host tidak valid — isi nama host lengkap atau alamat IP saja (tanpa http://, path, atau spasi).';
        }
        if ($host === 'localhost' || str_ends_with($host, '.localhost')) {
            return 'Host lokal server tidak diizinkan.';
        }

        if ($allowlisted) {
            return null; // dibuka eksplisit oleh pengelola server
        }

        $ips = $isIp ? [$host] : $this->resolve($host);
        if ($ips === []) {
            return "Host \"{$host}\" tidak dapat ditemukan (DNS).";
        }
        foreach ($ips as $ip) {
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_GLOBAL_RANGE) === false) {
                return 'Host mengarah ke alamat jaringan internal/cadangan yang tidak diizinkan. '
                    .'Bila server ini memang server internal resmi, minta pengelola server menambahkannya ke INTEGRATION_PRIVATE_HOSTS.';
            }
        }

        return null;
    }

    /** @return list<string> alamat IPv4/IPv6 hasil resolusi */
    protected function resolve(string $host): array
    {
        $ips = gethostbynamel($host) ?: [];
        foreach (@dns_get_record($host, DNS_AAAA) ?: [] as $record) {
            if (! empty($record['ipv6'])) {
                $ips[] = $record['ipv6'];
            }
        }

        return array_values(array_unique($ips));
    }

    /** @return list<string> */
    protected function privateAllowlist(): array
    {
        return array_values(array_filter(array_map(
            fn ($h) => strtolower(trim($h)),
            explode(',', (string) config('integrations.private_hosts', '')),
        )));
    }

    private function isHostname(string $host, bool $requireDot): bool
    {
        if (strlen($host) > 253 || ($requireDot && ! str_contains($host, '.'))) {
            return false;
        }
        foreach (explode('.', $host) as $label) {
            if (! preg_match('/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/', $label)) {
                return false;
            }
        }

        return true;
    }
}
