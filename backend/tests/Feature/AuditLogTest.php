<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditLogTest extends TestCase
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

    public function test_user_without_audit_permission_is_forbidden(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');

        $this->actingAs($viewer)->getJson('/api/audit-logs')->assertStatus(403);
    }

    public function test_sysadmin_can_list_audit_logs(): void
    {
        $this->activateLicense();
        AuditLog::create([
            'actor_name' => 'Sistem', 'action' => 'create', 'entity' => 'Document',
            'entity_id' => '1', 'entity_label' => 'DOC-001', 'detail' => 'Membuat dokumen uji',
        ]);
        $sysadmin = $this->makeUser('sysadmin');

        $response = $this->actingAs($sysadmin)->getJson('/api/audit-logs');
        $response->assertOk()->assertJsonPath('data.0.entity', 'Document');
    }

    public function test_filters_narrow_results(): void
    {
        $this->activateLicense();
        AuditLog::create(['actor_name' => 'Sistem', 'action' => 'create', 'entity' => 'Document', 'detail' => 'A']);
        AuditLog::create(['actor_name' => 'Sistem', 'action' => 'login', 'entity' => 'Session', 'detail' => 'B']);
        $sysadmin = $this->makeUser('sysadmin');

        $response = $this->actingAs($sysadmin)->getJson('/api/audit-logs?entity=Session');
        $response->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Session', $response->json('data.0.entity'));
    }

    public function test_audit_logs_cannot_be_modified_via_api(): void
    {
        // Tidak ada route store/update/destroy untuk audit-logs sama sekali —
        // POST ke path ini harus 405 (Method Not Allowed), bukan benar-benar
        // membuat baris. Ini memastikan itu tetap benar walau route file
        // berubah nanti.
        $this->activateLicense(); // baris audit ini sendiri wajar tercatat (log 'update' License)
        $sysadmin = $this->makeUser('sysadmin');
        $countBefore = AuditLog::count();

        $this->actingAs($sysadmin)->postJson('/api/audit-logs', ['detail' => 'coba suntik'])->assertStatus(405);
        $this->assertSame($countBefore, AuditLog::count());
    }
}
