<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserManagementTest extends TestCase
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

    private function makeUser(string $roleId, array $overrides = []): User
    {
        Role::firstOrCreate(['id' => $roleId], ['label' => ucfirst($roleId)]);
        $user = User::create(array_merge([
            'name' => 'Pengguna '.$roleId,
            'email' => $roleId.'@example.com',
            'password' => 'rahasia-panjang-sekali',
            'active' => true,
            'must_change_password' => false,
        ], $overrides));
        $user->roles()->attach($roleId);

        return $user;
    }

    public function test_non_manager_cannot_list_users(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');

        $this->actingAs($viewer)->getJson('/api/users')->assertStatus(403);
    }

    public function test_sysadmin_can_list_users(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $response = $this->actingAs($sysadmin)->getJson('/api/users');
        $response->assertOk()->assertJsonPath('data.0.email', 'sysadmin@example.com');
    }

    public function test_sysadmin_can_create_user_with_roles_and_receives_temp_password(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');
        Role::firstOrCreate(['id' => 'drafter'], ['label' => 'Document Drafter']);

        $response = $this->actingAs($sysadmin)->postJson('/api/users', [
            'name' => 'Budi Santoso',
            'email' => 'budi@example.com',
            'roles' => ['drafter'],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('user.email', 'budi@example.com')
            ->assertJsonPath('user.must_change_password', true);

        $tempPassword = $response->json('temporary_password');
        $this->assertNotEmpty($tempPassword);

        $created = User::where('email', 'budi@example.com')->first();
        $this->assertTrue(Hash::check($tempPassword, $created->password));
        $this->assertTrue($created->must_change_password);
        $this->assertSame(['drafter'], $created->roleIds());
    }

    public function test_duplicate_email_is_rejected(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');
        Role::firstOrCreate(['id' => 'drafter'], ['label' => 'Document Drafter']);

        $this->actingAs($sysadmin)->postJson('/api/users', [
            'name' => 'Duplikat', 'email' => 'sysadmin@example.com', 'roles' => ['drafter'],
        ])->assertStatus(422);
    }

    public function test_unknown_role_is_rejected(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $this->actingAs($sysadmin)->postJson('/api/users', [
            'name' => 'Siapa', 'email' => 'siapa@example.com', 'roles' => ['bukan-role'],
        ])->assertStatus(422);
    }

    public function test_sysadmin_can_update_roles_and_active_status(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');
        $drafter = $this->makeUser('drafter');
        Role::firstOrCreate(['id' => 'reviewer'], ['label' => 'Reviewer']);

        $response = $this->actingAs($sysadmin)->patchJson("/api/users/{$drafter->id}", [
            'roles' => ['reviewer'],
            'active' => false,
        ]);

        $response->assertOk()
            ->assertJsonPath('active', false)
            ->assertJsonPath('roles.0.id', 'reviewer');

        $this->assertDatabaseHas('audit_logs', ['action' => 'update', 'entity' => 'User']);
    }

    public function test_cannot_deactivate_own_account(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $this->actingAs($sysadmin)->patchJson("/api/users/{$sysadmin->id}", [
            'active' => false,
        ])->assertStatus(422);

        $this->assertTrue($sysadmin->fresh()->active);
    }

    public function test_cannot_strip_own_users_manage_role(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');
        Role::firstOrCreate(['id' => 'viewer'], ['label' => 'Viewer']);

        $this->actingAs($sysadmin)->patchJson("/api/users/{$sysadmin->id}", [
            'roles' => ['viewer'],
        ])->assertStatus(422);

        $this->assertSame(['sysadmin'], $sysadmin->fresh()->roleIds());
    }

    public function test_sysadmin_can_reset_another_users_password(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');
        $drafter = $this->makeUser('drafter', ['must_change_password' => false]);

        $response = $this->actingAs($sysadmin)->postJson("/api/users/{$drafter->id}/reset-password");

        $response->assertOk();
        $tempPassword = $response->json('temporary_password');
        $this->assertNotEmpty($tempPassword);

        $fresh = $drafter->fresh();
        $this->assertTrue(Hash::check($tempPassword, $fresh->password));
        $this->assertTrue($fresh->must_change_password);
        $this->assertDatabaseHas('audit_logs', ['action' => 'password_reset', 'entity' => 'User']);
    }

    public function test_non_manager_cannot_reset_password(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');
        $drafter = $this->makeUser('drafter');

        $this->actingAs($viewer)->postJson("/api/users/{$drafter->id}/reset-password")->assertStatus(403);
    }
}
