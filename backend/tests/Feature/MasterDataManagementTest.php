<?php

namespace Tests\Feature;

use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\Standard;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MasterDataManagementTest extends TestCase
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

    public function test_non_sysadmin_cannot_manage_master_data(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');

        $this->actingAs($viewer)->getJson('/api/master-data/org-functions')->assertStatus(403);
        $this->actingAs($viewer)->postJson('/api/master-data/org-functions', ['id' => 'x', 'name' => 'X'])->assertStatus(403);
        $this->actingAs($viewer)->getJson('/api/master-data/standards')->assertStatus(403);
    }

    public function test_sysadmin_can_create_org_function(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $response = $this->actingAs($sysadmin)->postJson('/api/master-data/org-functions', [
            'id' => 'marketing',
            'name' => 'Marketing',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('org_functions', ['id' => 'marketing', 'name' => 'Marketing', 'active' => true]);
    }

    public function test_org_function_id_must_match_slug_pattern(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $this->actingAs($sysadmin)->postJson('/api/master-data/org-functions', [
            'id' => 'Marketing-1',
            'name' => 'Marketing',
        ])->assertStatus(422);
    }

    public function test_org_function_id_must_be_unique(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');
        OrgFunction::create(['id' => 'qa', 'name' => 'Quality Assurance', 'active' => true]);

        $this->actingAs($sysadmin)->postJson('/api/master-data/org-functions', [
            'id' => 'qa',
            'name' => 'Duplikat',
        ])->assertStatus(422);
    }

    public function test_updating_org_function_cannot_change_id_only_name_and_active(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');
        OrgFunction::create(['id' => 'qa', 'name' => 'Quality Assurance', 'active' => true]);

        $response = $this->actingAs($sysadmin)->patchJson('/api/master-data/org-functions/qa', [
            'name' => 'Quality Assurance & Control',
            'active' => false,
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('org_functions', [
            'id' => 'qa',
            'name' => 'Quality Assurance & Control',
            'active' => false,
        ]);
    }

    public function test_org_functions_list_includes_document_and_user_counts(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');
        $fn = OrgFunction::create(['id' => 'qa', 'name' => 'Quality Assurance', 'active' => true]);
        \App\Models\Document::create([
            'code' => 'SOP-QA-0001', 'title' => 'Dok Uji', 'type' => 'SOP',
            'function_id' => $fn->id, 'classification' => 'internal', 'status' => 'draft',
            'validity' => 'belum_berlaku', 'version' => '1.0', 'revision_number' => 0,
        ]);

        $response = $this->actingAs($sysadmin)->getJson('/api/master-data/org-functions');

        $response->assertOk();
        $row = collect($response->json())->firstWhere('id', 'qa');
        $this->assertSame(1, $row['documents_count']);
    }

    public function test_sysadmin_can_create_and_update_standard(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $create = $this->actingAs($sysadmin)->postJson('/api/master-data/standards', [
            'code' => 'ISO9001',
            'name' => 'ISO 9001 — Quality Management',
        ]);
        $create->assertCreated();
        $this->assertDatabaseHas('standards', ['code' => 'ISO9001', 'active' => true]);

        $update = $this->actingAs($sysadmin)->patchJson('/api/master-data/standards/ISO9001', ['active' => false]);
        $update->assertOk();
        $this->assertDatabaseHas('standards', ['code' => 'ISO9001', 'active' => false]);
    }

    public function test_standard_code_must_be_unique(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');
        Standard::create(['code' => 'ISO9001', 'name' => 'ISO 9001', 'active' => true]);

        $this->actingAs($sysadmin)->postJson('/api/master-data/standards', [
            'code' => 'ISO9001',
            'name' => 'Duplikat',
        ])->assertStatus(422);
    }

    public function test_index_dropdown_endpoint_stays_public_to_authenticated_users(): void
    {
        $this->activateLicense();
        $drafter = $this->makeUser('drafter');
        OrgFunction::create(['id' => 'qa', 'name' => 'Quality Assurance', 'active' => true]);
        OrgFunction::create(['id' => 'legacy', 'name' => 'Legacy Nonaktif', 'active' => false]);

        $response = $this->actingAs($drafter)->getJson('/api/master-data');

        $response->assertOk();
        $this->assertCount(1, $response->json('functions'));
    }
}
