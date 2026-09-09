<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\Standard;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ComplianceMatrixTest extends TestCase
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

    private function makeDocument(string $status, array $overrides = []): Document
    {
        $fn = OrgFunction::firstOrCreate(['id' => 'qa'], ['name' => 'Quality Assurance', 'active' => true]);

        return Document::create(array_merge([
            'code' => 'SOP-QA-'.random_int(1000, 9999),
            'title' => 'Dokumen Uji '.$status,
            'type' => 'SOP',
            'function_id' => $fn->id,
            'classification' => 'internal',
            'status' => $status,
            'validity' => 'belum_berlaku',
            'version' => '1.0',
            'revision_number' => 0,
        ], $overrides));
    }

    public function test_viewer_without_reporting_view_is_forbidden(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');

        $this->actingAs($viewer)->getJson('/api/compliance-matrix')->assertStatus(403);
    }

    public function test_standard_with_no_tagged_documents_is_a_gap(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        Standard::create(['code' => 'ISO9001', 'name' => 'ISO 9001', 'active' => true]);

        $response = $this->actingAs($controller)->getJson('/api/compliance-matrix');

        $response->assertOk();
        $row = collect($response->json('standards'))->firstWhere('code', 'ISO9001');
        $this->assertTrue($row['has_gap']);
        $this->assertSame(0, $row['documents_count']);
        $this->assertContains('ISO9001', $response->json('summary.gaps'));
    }

    public function test_standard_with_only_draft_document_is_still_a_gap(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $standard = Standard::create(['code' => 'ISO9001', 'name' => 'ISO 9001', 'active' => true]);
        $doc = $this->makeDocument('draft');
        $doc->standards()->attach($standard->code);

        $response = $this->actingAs($controller)->getJson('/api/compliance-matrix');

        $row = collect($response->json('standards'))->firstWhere('code', 'ISO9001');
        $this->assertTrue($row['has_gap']);
        $this->assertSame(1, $row['documents_count']);
        $this->assertSame(0, $row['released_count']);
    }

    public function test_standard_with_released_document_is_covered(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $standard = Standard::create(['code' => 'ISO9001', 'name' => 'ISO 9001', 'active' => true]);
        $doc = $this->makeDocument('released');
        $doc->standards()->attach($standard->code);

        $response = $this->actingAs($controller)->getJson('/api/compliance-matrix');

        $row = collect($response->json('standards'))->firstWhere('code', 'ISO9001');
        $this->assertFalse($row['has_gap']);
        $this->assertSame(1, $row['released_count']);
        $this->assertSame(1, $response->json('summary.covered'));
        $this->assertNotContains('ISO9001', $response->json('summary.gaps'));
    }

    public function test_inactive_standards_are_excluded(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        Standard::create(['code' => 'OLDSTD', 'name' => 'Standar Lama', 'active' => false]);

        $response = $this->actingAs($controller)->getJson('/api/compliance-matrix');

        $codes = collect($response->json('standards'))->pluck('code');
        $this->assertNotContains('OLDSTD', $codes);
    }
}
