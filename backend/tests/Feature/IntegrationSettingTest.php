<?php

namespace Tests\Feature;

use App\Mail\IntegrationTestMail;
use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class IntegrationSettingTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_sysadmin_sees_all_four_integrations_with_no_secrets_exposed(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $response = $this->actingAs($sysadmin)->getJson('/api/integrations');

        $response->assertOk();
        $types = collect($response->json('integrations'))->pluck('type');
        $this->assertEqualsCanonicalizing(['smtp', 'ldap', 'docusign', 'google_drive'], $types->all());

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
            'recipient' => 'admin@example.com',
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
}
