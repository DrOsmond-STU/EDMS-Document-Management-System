<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\IntegrationTestMail;
use App\Models\IntegrationSetting;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Integration & API — hub pengaturan koneksi ke sistem eksternal (Email/
 * SMTP, Active Directory/LDAP, DocuSign, Google Drive). Kredensial rahasia
 * (password/client_secret) disimpan terenkripsi dan TIDAK PERNAH dikirim
 * balik ke frontend — hanya penanda `secrets_present` per field. Baru
 * SMTP & LDAP yang punya uji koneksi sungguhan (SMTP: kirim email uji;
 * LDAP: ldap_connect+bind sungguhan); DocuSign & Google Drive memakai
 * OAuth2 yang belum diimplementasikan alurnya di batch ini — kredensial
 * bisa disimpan, tapi status akan selalu "belum tersambung" sampai
 * alur OAuth-nya dibangun.
 */
class IntegrationSettingController extends Controller
{
    /** @var array<string, array{label: string, description: string, test_supported: bool, fields: list<array>}> */
    private const SCHEMAS = [
        'smtp' => [
            'label' => 'Email / SMTP',
            'description' => 'Pengiriman notifikasi, reminder tinjauan ulang dokumen, dan digest audit.',
            'test_supported' => true,
            'fields' => [
                ['key' => 'host', 'label' => 'Host SMTP', 'input' => 'text', 'required' => true, 'secret' => false],
                ['key' => 'port', 'label' => 'Port', 'input' => 'number', 'required' => true, 'secret' => false, 'default' => 587],
                ['key' => 'encryption', 'label' => 'Enkripsi', 'input' => 'select', 'options' => ['none', 'tls'], 'required' => false, 'secret' => false, 'default' => 'none'],
                ['key' => 'username', 'label' => 'Username', 'input' => 'text', 'required' => false, 'secret' => false],
                ['key' => 'password', 'label' => 'Password', 'input' => 'password', 'required' => false, 'secret' => true],
                ['key' => 'from_address', 'label' => 'Alamat Pengirim', 'input' => 'email', 'required' => true, 'secret' => false],
                ['key' => 'from_name', 'label' => 'Nama Pengirim', 'input' => 'text', 'required' => false, 'secret' => false],
            ],
        ],
        'ldap' => [
            'label' => 'Active Directory',
            'description' => 'SSO & sinkronisasi user, group, dan role dari AD/LDAP.',
            'test_supported' => true,
            'fields' => [
                ['key' => 'host', 'label' => 'Host LDAP', 'input' => 'text', 'required' => true, 'secret' => false],
                ['key' => 'port', 'label' => 'Port', 'input' => 'number', 'required' => true, 'secret' => false, 'default' => 389],
                ['key' => 'base_dn', 'label' => 'Base DN', 'input' => 'text', 'required' => true, 'secret' => false],
                ['key' => 'bind_dn', 'label' => 'Bind DN', 'input' => 'text', 'required' => false, 'secret' => false],
                ['key' => 'bind_password', 'label' => 'Bind Password', 'input' => 'password', 'required' => false, 'secret' => true],
                ['key' => 'user_filter', 'label' => 'Filter Pengguna', 'input' => 'text', 'required' => false, 'secret' => false, 'default' => '(mail=%s)'],
            ],
        ],
        'docusign' => [
            'label' => 'DocuSign',
            'description' => 'e-Signature untuk approval dokumen legal & kontrak.',
            'test_supported' => false,
            'fields' => [
                ['key' => 'client_id', 'label' => 'Integration Key (Client ID)', 'input' => 'text', 'required' => false, 'secret' => false],
                ['key' => 'client_secret', 'label' => 'Client Secret', 'input' => 'password', 'required' => false, 'secret' => true],
                ['key' => 'account_id', 'label' => 'Account ID', 'input' => 'text', 'required' => false, 'secret' => false],
                ['key' => 'base_uri', 'label' => 'Base URI', 'input' => 'text', 'required' => false, 'secret' => false, 'default' => 'https://demo.docusign.net/restapi'],
                ['key' => 'redirect_uri', 'label' => 'Redirect URI', 'input' => 'text', 'required' => false, 'secret' => false],
            ],
        ],
        'google_drive' => [
            'label' => 'Google Drive',
            'description' => 'Import dokumen legacy dan backup arsip ke Drive.',
            'test_supported' => false,
            'fields' => [
                ['key' => 'client_id', 'label' => 'Client ID', 'input' => 'text', 'required' => false, 'secret' => false],
                ['key' => 'client_secret', 'label' => 'Client Secret', 'input' => 'password', 'required' => false, 'secret' => true],
                ['key' => 'redirect_uri', 'label' => 'Redirect URI', 'input' => 'text', 'required' => false, 'secret' => false],
                ['key' => 'folder_id', 'label' => 'Folder ID Tujuan', 'input' => 'text', 'required' => false, 'secret' => false],
            ],
        ],
    ];

    public function __construct(private AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }

        $integrations = collect(IntegrationSetting::TYPES)
            ->map(fn (string $type) => $this->payload(IntegrationSetting::forType($type)))
            ->values();

        return response()->json(['integrations' => $integrations]);
    }

    public function update(Request $request, string $type): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }
        if (! in_array($type, IntegrationSetting::TYPES, true)) {
            return response()->json(['message' => 'Jenis integrasi tidak dikenal.'], 404);
        }

        $schema = self::SCHEMAS[$type];
        $configFields = array_column(array_filter($schema['fields'], fn ($f) => ! $f['secret']), 'key');
        $secretFields = array_column(array_filter($schema['fields'], fn ($f) => $f['secret']), 'key');

        $rules = ['enabled' => ['sometimes', 'boolean']];
        foreach ($schema['fields'] as $field) {
            $bucket = $field['secret'] ? 'secrets' : 'config';
            $rules["{$bucket}.{$field['key']}"] = $field['input'] === 'number'
                ? ['sometimes', 'nullable', 'numeric']
                : ['sometimes', 'nullable', 'string', 'max:500'];
        }
        $data = $request->validate($rules);

        $setting = IntegrationSetting::forType($type);

        $config = array_merge($setting->config ?? [], array_intersect_key($data['config'] ?? [], array_flip($configFields)));

        // Secret KOSONG berarti "biarkan yang sudah tersimpan" — supaya admin
        // tidak perlu ketik ulang password tiap kali menyimpan field lain.
        $incomingSecrets = array_filter(
            array_intersect_key($data['secrets'] ?? [], array_flip($secretFields)),
            fn ($v) => $v !== null && $v !== '',
        );
        $secrets = array_merge($setting->secrets ?? [], $incomingSecrets);

        $setting->config = $config;
        $setting->secrets = $secrets;
        if (array_key_exists('enabled', $data)) {
            $setting->enabled = $data['enabled'];
        }
        $setting->updated_by = $request->user()->id;
        $setting->save();

        $this->audit->log($request->user(), 'update', 'IntegrationSetting', $type, $schema['label'],
            "Memperbarui pengaturan integrasi \"{$schema['label']}\"".(array_key_exists('enabled', $data) ? ($data['enabled'] ? ' (diaktifkan)' : ' (dinonaktifkan)') : '').'.');

        return response()->json($this->payload($setting->fresh()));
    }

    public function test(Request $request, string $type): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->forbidden();
        }
        if (! in_array($type, IntegrationSetting::TYPES, true)) {
            return response()->json(['message' => 'Jenis integrasi tidak dikenal.'], 404);
        }

        $setting = IntegrationSetting::forType($type);
        $schema = self::SCHEMAS[$type];

        if (! $schema['test_supported']) {
            return response()->json([
                'message' => "Uji koneksi untuk {$schema['label']} belum tersedia — integrasi ini memakai OAuth2 yang alur otorisasinya belum diimplementasikan. Kredensial tetap tersimpan untuk dipakai saat alur OAuth dibangun.",
                'integration' => $this->payload($setting),
            ], 422);
        }

        [$success, $message] = match ($type) {
            'smtp' => $this->testSmtp($setting, $request),
            'ldap' => $this->testLdap($setting),
            default => [false, 'Tidak didukung.'],
        };

        $setting->status = $success ? 'connected' : 'failed';
        $setting->last_tested_at = now();
        $setting->last_test_message = $message;
        $setting->save();

        $this->audit->log($request->user(), 'update', 'IntegrationSetting', $type, $schema['label'],
            "Menguji koneksi \"{$schema['label']}\": ".($success ? 'berhasil' : 'gagal').' — '.$message);

        return response()->json($this->payload($setting->fresh()), $success ? 200 : 422);
    }

    /** @return array{0: bool, 1: string} */
    private function testSmtp(IntegrationSetting $setting, Request $request): array
    {
        $recipient = $request->string('recipient')->trim()->toString() ?: $request->user()->email;
        if (! filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            return [false, 'Alamat email penerima uji tidak valid.'];
        }

        $host = $setting->value('host');
        $fromAddress = $setting->value('from_address');
        if (! $host || ! $fromAddress) {
            return [false, 'Host dan Alamat Pengirim wajib diisi & disimpan sebelum diuji.'];
        }

        config(['mail.mailers.integration_smtp_test' => [
            'transport' => 'smtp',
            'host' => $host,
            'port' => (int) ($setting->value('port') ?: 587),
            'encryption' => $setting->value('encryption') === 'tls' ? 'tls' : null,
            'username' => $setting->value('username') ?: null,
            'password' => $setting->secrets['password'] ?? null,
            'timeout' => 10,
        ]]);

        try {
            Mail::mailer('integration_smtp_test')
                ->to($recipient)
                ->send(new IntegrationTestMail($fromAddress, $setting->value('from_name') ?: 'EDMS'));

            return [true, "Email uji berhasil dikirim ke {$recipient}."];
        } catch (\Throwable $e) {
            return [false, 'Gagal mengirim email uji: '.$e->getMessage()];
        }
    }

    /** @return array{0: bool, 1: string} */
    private function testLdap(IntegrationSetting $setting): array
    {
        if (! extension_loaded('ldap')) {
            return [false, 'Ekstensi PHP "ldap" tidak tersedia di server ini — hubungi penyedia hosting untuk mengaktifkannya sebelum AD/LDAP bisa dipakai.'];
        }

        $host = $setting->value('host');
        $baseDn = $setting->value('base_dn');
        if (! $host || ! $baseDn) {
            return [false, 'Host dan Base DN wajib diisi & disimpan sebelum diuji.'];
        }

        $port = (int) ($setting->value('port') ?: 389);
        $bindDn = $setting->value('bind_dn');
        $bindPassword = $setting->secrets['bind_password'] ?? null;

        $connection = @ldap_connect($host, $port);
        if (! $connection) {
            return [false, "Tidak bisa membuka koneksi ke {$host}:{$port}."];
        }

        ldap_set_option($connection, LDAP_OPT_PROTOCOL_VERSION, 3);
        ldap_set_option($connection, LDAP_OPT_NETWORK_TIMEOUT, 8);

        try {
            $bound = $bindDn
                ? @ldap_bind($connection, $bindDn, (string) $bindPassword)
                : @ldap_bind($connection); // anonymous bind untuk sekadar memastikan server bisa dijangkau
        } catch (\Throwable) {
            $bound = false;
        }

        if (! $bound) {
            $error = ldap_error($connection);
            ldap_unbind($connection);

            return [false, "Bind LDAP gagal: {$error}."];
        }

        ldap_unbind($connection);

        return [true, "Berhasil terhubung & bind ke {$host}:{$port}."];
    }

    private function payload(IntegrationSetting $setting): array
    {
        $schema = self::SCHEMAS[$setting->type];
        $config = $setting->config ?? [];
        $secrets = $setting->secrets ?? [];

        $configOut = [];
        $secretsPresent = [];
        foreach ($schema['fields'] as $field) {
            if ($field['secret']) {
                $secretsPresent[$field['key']] = ! empty($secrets[$field['key']]);
            } else {
                $configOut[$field['key']] = $config[$field['key']] ?? $field['default'] ?? null;
            }
        }

        return [
            'type' => $setting->type,
            'label' => $schema['label'],
            'description' => $schema['description'],
            'test_supported' => $schema['test_supported'],
            'fields' => $schema['fields'],
            'enabled' => $setting->enabled,
            'status' => $setting->status,
            'last_tested_at' => $setting->last_tested_at,
            'last_test_message' => $setting->last_test_message,
            'config' => $configOut,
            'secrets_present' => $secretsPresent,
            'updated_at' => $setting->updated_at,
        ];
    }

    private function authorized(Request $request): bool
    {
        return $request->user()->hasPermission(Permissions::MASTERDATA_MANAGE);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['message' => 'Anda tidak berwenang mengelola integrasi.'], 403);
    }
}
