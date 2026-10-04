<?php

namespace Tests\Feature;

use App\Mail\IntegrationTestMail;
use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class IntegrationSettingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fakeOutboundDns([
            'smtp.example.com' => ['93.184.215.14'],
            'ldap.example.com' => ['93.184.215.15'],
            'smtp.internal.example.com' => ['10.0.0.5'],
            'metadata.example.com' => ['169.254.169.254'],
            'campur.example.com' => ['93.184.215.14', '192.168.1.10'],
        ]);
    }

    private function activateLicense(): void
    {
        $service = app(LicenseService::class);
        $expires = now()->addYear()->toDateString();
        $signature = $service->computeSignature('EDMS-TEST-0001', $expires, 'active', 'PT Uji', '');
        $this->postJson('/api/license/apply', [
            'license_key' => 'EDMS-TEST-0001',
            'expires_at' => $expires,
            'status' => 'active',
            'company_name' => 'PT Uji',
            'signature' => $signature,
        ])->assertOk();
    }

    private function makeUser(string $roleId): User
    {
        Role::firstOrCreate(['id' => $roleId], ['label' => ucfirst($roleId)]);
        $user = User::create([
            'name' => 'Pengguna '.$roleId,
            'email' => $roleId.'@example.com',
            'password' => 'rahasia-panjang-sekali',
            'active' => true,
            'must_change_password' => false,
        ]);
        $user->roles()->attach($roleId);

        return $user;
    }

    public function test_non_manager_is_forbidden(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');

        $this->actingAs($viewer)->getJson('/api/integrations')->assertStatus(403);
        $this->actingAs($viewer)->patchJson('/api/integrations/smtp', [])->assertStatus(403);
        $this->actingAs($viewer)->postJson('/api/integrations/smtp/test')->assertStatus(403);
    }

    public function test_sysadmin_sees_all_integrations_with_no_secrets_exposed(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $response = $this->actingAs($sysadmin)->getJson('/api/integrations');

        $response->assertOk();
        $types = collect($response->json('integrations'))->pluck('type');
        $this->assertEqualsCanonicalizing(['smtp', 'ldap', 'docusign', 'google_drive', 'ai'], $types->all());

        $smtp = collect($response->json('integrations'))->firstWhere('type', 'smtp');
        $this->assertFalse($smtp['secrets_present']['password']);
        $this->assertArrayNotHasKey('password', $smtp['config']); // password tidak pernah ada di config biasa
    }

    public function test_unknown_integration_type_is_404(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $this->actingAs($sysadmin)->patchJson('/api/integrations/whatsapp', [])->assertStatus(404);
    }

    public function test_sysadmin_can_save_smtp_config_and_secret_is_masked_after(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $response = $this->actingAs($sysadmin)->patchJson('/api/integrations/smtp', [
            'config' => ['host' => 'smtp.example.com', 'port' => '587', 'from_address' => 'edms@example.com', 'from_name' => 'EDMS'],
            'secrets' => ['password' => 'rahasia-smtp'],
            'enabled' => true,
        ]);

        $response->assertOk()
            ->assertJsonPath('config.host', 'smtp.example.com')
            ->assertJsonPath('secrets_present.password', true)
            ->assertJsonPath('enabled', true);

        $this->assertArrayNotHasKey('password', $response->json('config'));
        $this->assertDatabaseHas('audit_logs', ['action' => 'update', 'entity' => 'IntegrationSetting', 'entity_id' => 'smtp']);
    }

    public function test_saving_without_new_secret_keeps_previously_stored_secret(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $this->actingAs($sysadmin)->patchJson('/api/integrations/smtp', [
            'config' => ['host' => 'smtp.example.com', 'from_address' => 'edms@example.com'],
            'secrets' => ['password' => 'rahasia-awal'],
        ])->assertOk();

        // Simpan lagi TANPA mengirim password — field lain saja yang berubah.
        $response = $this->actingAs($sysadmin)->patchJson('/api/integrations/smtp', [
            'config' => ['host' => 'smtp.example.com', 'from_address' => 'edms@example.com', 'from_name' => 'EDMS Baru'],
        ]);

        $response->assertOk()->assertJsonPath('secrets_present.password', true);

        $setting = \App\Models\IntegrationSetting::forType('smtp');
        $this->assertSame('rahasia-awal', $setting->secrets['password']); // tidak tertimpa kosong
    }

    public function test_smtp_test_connection_sends_test_mail_and_marks_connected(): void
    {
        $this->activateLicense();
        Mail::fake();
        $sysadmin = $this->makeUser('sysadmin');

        $this->actingAs($sysadmin)->patchJson('/api/integrations/smtp', [
            'config' => ['host' => 'smtp.example.com', 'port' => '587', 'from_address' => 'edms@example.com', 'from_name' => 'EDMS'],
        ])->assertOk();

        $response = $this->actingAs($sysadmin)->postJson('/api/integrations/smtp/test', [
            'recipient' => 'sysadmin@example.com',
        ]);

        $response->assertOk()->assertJsonPath('status', 'connected');
        Mail::assertSent(IntegrationTestMail::class);
        $this->assertDatabaseHas('integration_settings', ['type' => 'smtp', 'status' => 'connected']);
    }

    public function test_smtp_test_fails_clearly_when_host_missing(): void
    {
        $this->activateLicense();
        Mail::fake();
        $sysadmin = $this->makeUser('sysadmin');

        $response = $this->actingAs($sysadmin)->postJson('/api/integrations/smtp/test');

        $response->assertStatus(422)->assertJsonPath('status', 'failed');
        Mail::assertNothingSent();
    }

    public function test_ldap_test_reports_missing_extension_honestly(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $this->actingAs($sysadmin)->patchJson('/api/integrations/ldap', [
            'config' => ['host' => 'ldap.example.com', 'base_dn' => 'dc=example,dc=com'],
        ])->assertOk();

        $response = $this->actingAs($sysadmin)->postJson('/api/integrations/ldap/test');

        if (extension_loaded('ldap')) {
            // Di lingkungan yang punya ekstensi ldap, hasilnya bergantung pada
            // jangkauan jaringan — cukup pastikan endpoint merespons dengan wajar.
            $this->assertContains($response->status(), [200, 422]);
        } else {
            $response->assertStatus(422);
            $this->assertStringContainsString('ldap', strtolower($response->json('last_test_message')));
        }
    }

    public function test_docusign_and_google_drive_test_report_not_yet_supported(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        foreach (['docusign', 'google_drive'] as $type) {
            $response = $this->actingAs($sysadmin)->postJson("/api/integrations/{$type}/test");
            $response->assertStatus(422);
            $this->assertStringContainsString('OAuth2', $response->json('message'));
        }
    }

    /** @return list<array{0: string, 1: int|string}> */
    public static function blockedDestinations(): array
    {
        return [
            'loopback IP' => ['127.0.0.1', 587],
            'localhost' => ['localhost', 587],
            'jaringan privat (IP)' => ['192.168.1.1', 25],
            'jaringan privat (DNS)' => ['smtp.internal.example.com', 587],
            'metadata cloud' => ['metadata.example.com', 587],
            'metadata cloud (IP)' => ['169.254.169.254', 587],
            'sebagian alamat privat' => ['campur.example.com', 587],
            'CGNAT' => ['100.64.0.1', 587],
            'IPv6 loopback' => ['::1', 587],
            'port database' => ['smtp.example.com', 3306],
            'port redis' => ['smtp.example.com', 6379],
            'skema URL' => ['http://smtp.example.com', 587],
            'host tak dikenal' => ['tidak-ada.example.com', 587],
        ];
    }

    #[DataProvider('blockedDestinations')]
    public function test_smtp_destinations_inside_the_server_network_are_refused(string $host, int|string $port): void
    {
        $this->activateLicense();
        Mail::fake();
        $admin = $this->makeUser('sysadmin');

        $this->actingAs($admin)->patchJson('/api/integrations/smtp', [
            'config' => ['host' => $host, 'port' => $port, 'from_address' => 'edms@example.com'],
        ])->assertUnprocessable()->assertJsonValidationErrors('config.host');

        Mail::assertNothingSent();
        $this->assertNull(\App\Models\IntegrationSetting::forType('smtp')->value('host'), 'Tujuan terlarang tidak boleh tersimpan.');
    }

    public function test_test_endpoint_rechecks_a_previously_stored_internal_host(): void
    {
        $this->activateLicense();
        Mail::fake();
        $admin = $this->makeUser('sysadmin');
        // Simulasi data lama yang tersimpan sebelum penjaga ada.
        $setting = \App\Models\IntegrationSetting::forType('smtp');
        $setting->config = ['host' => '10.1.2.3', 'port' => 587, 'from_address' => 'edms@example.com'];
        $setting->enabled = true;
        $setting->save();

        $this->actingAs($admin)->postJson('/api/integrations/smtp/test', ['recipient' => 'sysadmin@example.com'])
            ->assertUnprocessable()->assertJsonPath('message', fn ($m) => str_contains($m, 'jaringan internal'));
        Mail::assertNothingSent();
        $this->assertNull(app(\App\Services\IntegrationMailerFactory::class)->smtpMailerName(), 'Pengiriman email sungguhan juga harus diblokir.');
    }

    public function test_test_mail_only_goes_to_active_users_and_ldap_ports_are_restricted(): void
    {
        $this->activateLicense();
        Mail::fake();
        $admin = $this->makeUser('sysadmin');
        $this->actingAs($admin)->patchJson('/api/integrations/smtp', [
            'config' => ['host' => 'smtp.example.com', 'port' => 587, 'from_address' => 'edms@example.com'],
        ])->assertOk();

        $this->actingAs($admin)->postJson('/api/integrations/smtp/test', ['recipient' => 'orang-luar@gmail.com'])
            ->assertUnprocessable()->assertJsonPath('last_test_message', fn ($m) => str_contains($m, 'pengguna aktif'));
        Mail::assertNothingSent();

        $this->actingAs($admin)->patchJson('/api/integrations/ldap', ['config' => ['host' => 'ldap.example.com', 'port' => 22, 'base_dn' => 'dc=x']])
            ->assertUnprocessable()->assertJsonValidationErrors('config.host');
        $this->actingAs($admin)->patchJson('/api/integrations/ldap', ['config' => ['host' => 'ldap.example.com', 'port' => 636, 'base_dn' => 'dc=x']])
            ->assertOk();
    }

    public function test_internal_host_is_allowed_only_when_the_server_operator_lists_it(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('sysadmin');
        $payload = ['config' => ['host' => 'smtp.internal.example.com', 'port' => 25, 'from_address' => 'edms@example.com']];

        $this->actingAs($admin)->patchJson('/api/integrations/smtp', $payload)->assertUnprocessable();
        config(['integrations.private_hosts' => 'smtp.internal.example.com, ad-kantor']);
        $this->actingAs($admin)->patchJson('/api/integrations/smtp', $payload)->assertOk();
        $this->actingAs($admin)->patchJson('/api/integrations/ldap', ['config' => ['host' => 'ad-kantor', 'port' => 389, 'base_dn' => 'dc=x']])->assertOk();
    }

    public function test_connection_test_is_rate_limited(): void
    {
        $this->activateLicense();
        Mail::fake();
        $admin = $this->makeUser('sysadmin');
        $statuses = [];
        for ($i = 0; $i < 7; $i++) {
            $statuses[] = $this->actingAs($admin)->postJson('/api/integrations/smtp/test')->status();
        }
        $this->assertContains(429, $statuses);
    }
}
