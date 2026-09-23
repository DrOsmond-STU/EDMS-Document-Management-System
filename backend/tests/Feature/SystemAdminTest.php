<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SystemAdminTest extends TestCase
{
    use RefreshDatabase;

    private ?string $logBackup = null;

    protected function tearDown(): void
    {
        $log = storage_path('logs/laravel.log');
        if ($this->logBackup !== null) {
            file_put_contents($log, $this->logBackup);
        }
        parent::tearDown();
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

    private function makeUser(string $roleId, bool $mustChange = false): User
    {
        Role::firstOrCreate(['id' => $roleId], ['label' => ucfirst($roleId)]);
        $user = User::create([
            'name' => 'Pengguna '.$roleId,
            'email' => $roleId.'@example.com',
            'password' => 'rahasia-panjang-sekali',
            'active' => true,
            'must_change_password' => $mustChange,
        ]);
        $user->roles()->attach($roleId);

        return $user;
    }

    public function test_only_sysadmin_can_open_panel(): void
    {
        $this->activateLicense();
        $this->actingAs($this->makeUser('compliance_admin'))->getJson('/api/system/info')->assertStatus(403);
        $this->actingAs($this->makeUser('sysadmin'))->getJson('/api/system/info')->assertOk();
    }

    public function test_panel_reports_runtime_checks_and_volumes_without_secrets(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $response = $this->actingAs($sysadmin)->getJson('/api/system/info');

        $response->assertOk()->assertJsonStructure([
            'runtime' => ['php', 'laravel', 'db_driver', 'environment', 'config_cached', 'routes_cached'],
            'checks' => [['key', 'label', 'status', 'detail']],
            'storage' => ['documents_files', 'documents_bytes', 'registered_files', 'log_bytes'],
            'volumes',
            'errors',
        ]);
        $this->assertSame(PHP_VERSION, $response->json('runtime.php'));
        $this->assertSame('ok', collect($response->json('checks'))->firstWhere('key', 'license')['status']);

        $raw = $response->getContent();
        $this->assertStringNotContainsString((string) config('app.key'), $raw);
        if ($dbPassword = config('database.connections.'.config('database.default').'.password')) {
            $this->assertStringNotContainsString($dbPassword, $raw);
        }
    }

    public function test_default_password_accounts_are_flagged(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');
        $this->makeUser('viewer', mustChange: true);

        $check = collect($this->actingAs($sysadmin)->getJson('/api/system/info')->json('checks'))->firstWhere('key', 'default_passwords');

        $this->assertSame('warn', $check['status']);
        $this->assertStringContainsString('1 akun', $check['detail']);
    }

    public function test_recent_errors_show_headline_only_never_stack_trace(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');
        $log = storage_path('logs/laravel.log');
        $this->logBackup = is_file($log) ? file_get_contents($log) : '';
        file_put_contents($log, $this->logBackup
            ."[2026-09-20 10:11:12] production.ERROR: SQLSTATE[42S02]: Base table not found {\"exception\":\"x\"}\n"
            ."#0 /home/app/vendor/secret/path.php(12): Foo->bar()\n"
            ."[2026-09-20 10:12:00] production.INFO: Bukan error\n");

        $errors = $this->actingAs($sysadmin)->getJson('/api/system/info')->json('errors');

        $this->assertSame('ERROR', $errors[0]['level']);
        $this->assertSame('2026-09-20 10:11:12', $errors[0]['time']);
        $this->assertStringStartsWith('SQLSTATE[42S02]', $errors[0]['message']);
        $this->assertStringNotContainsString('secret/path.php', json_encode($errors));
        $this->assertNotContains('Bukan error', array_column($errors, 'message'));
    }

    public function test_cache_clear_is_sysadmin_only_and_audited(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $this->actingAs($this->makeUser('controller'))->postJson('/api/system/cache-clear')->assertStatus(403);
        $this->actingAs($sysadmin)->postJson('/api/system/cache-clear')->assertOk()->assertJsonPath('cleared', true);
        $this->assertDatabaseHas('audit_logs', ['entity' => 'System', 'actor_id' => $sysadmin->id]);
    }
}
