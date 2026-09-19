<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\Standard;
use App\Models\StandardClause;
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

    private function makeDocument(array $overrides = []): Document
    {
        $fn = OrgFunction::firstOrCreate(['id' => 'qa'], ['name' => 'Quality Assurance', 'active' => true]);

        return Document::create(array_merge([
            'code' => 'SOP-QA-'.random_int(1000, 9999),
            'title' => 'Dokumen Uji',
            'type' => 'SOP',
            'function_id' => $fn->id,
            'classification' => 'internal',
            'status' => 'released',
            'validity' => 'berlaku',
            'version' => '1.0',
            'revision_number' => 0,
        ], $overrides));
    }

    private function makeClause(array $overrides = []): StandardClause
    {
        Standard::firstOrCreate(['code' => 'ISO9001'], ['name' => 'ISO 9001', 'active' => true]);

        return StandardClause::create(array_merge([
            'standard_code' => 'ISO9001',
            'code' => '4.1',
            'title' => 'Konteks Organisasi',
            'sort_order' => 0,
        ], $overrides));
    }

    public function test_viewer_without_reporting_view_is_forbidden(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');

        $this->actingAs($viewer)->getJson('/api/compliance-matrix')->assertStatus(403);
    }

    public function test_index_returns_clauses_documents_and_stats(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $this->makeClause();
        $this->makeDocument();

        $response = $this->actingAs($controller)->getJson('/api/compliance-matrix');

        $response->assertOk();
        $this->assertCount(1, $response->json('clauses'));
        $this->assertCount(1, $response->json('documents'));
        $this->assertSame(1, $response->json('stats.total_cells'));
        $this->assertSame(0, $response->json('stats.assessed_cells'));
        $this->assertSame(1, $response->json('stats.unassessed'));
    }

    public function test_filter_by_standard_narrows_clauses_but_not_documents(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $this->makeClause(['standard_code' => 'ISO9001', 'code' => '4.1']);
        Standard::create(['code' => 'ISO14001', 'name' => 'ISO 14001', 'active' => true]);
        StandardClause::create(['standard_code' => 'ISO14001', 'code' => '4.1', 'title' => 'Konteks Organisasi', 'sort_order' => 0]);
        $this->makeDocument();

        $response = $this->actingAs($controller)->getJson('/api/compliance-matrix?standard=ISO9001');

        $this->assertCount(1, $response->json('clauses'));
        $this->assertSame('ISO9001', $response->json('clauses.0.standard_code'));
        $this->assertCount(1, $response->json('documents')); // dokumen tidak ikut difilter
    }

    public function test_viewer_cannot_assess_but_compliance_admin_can(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');
        $complianceAdmin = $this->makeUser('compliance_admin');
        $clause = $this->makeClause();
        $doc = $this->makeDocument();

        $this->actingAs($viewer)->patchJson('/api/compliance-matrix/assessments', [
            'clause_id' => $clause->id, 'document_id' => $doc->id, 'status' => 'compliant',
        ])->assertStatus(403);

        $response = $this->actingAs($complianceAdmin)->patchJson('/api/compliance-matrix/assessments', [
            'clause_id' => $clause->id, 'document_id' => $doc->id, 'status' => 'compliant', 'note' => 'Sudah sesuai.',
        ]);

        $response->assertOk();
        $this->assertSame('compliant', $response->json('status'));
        $this->assertSame('Sudah sesuai.', $response->json('note'));
        $this->assertDatabaseHas('clause_assessments', ['clause_id' => $clause->id, 'document_id' => $doc->id, 'status' => 'compliant']);
    }

    public function test_reassessing_the_same_cell_updates_it_instead_of_duplicating(): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');
        $clause = $this->makeClause();
        $doc = $this->makeDocument();

        $this->actingAs($complianceAdmin)->patchJson('/api/compliance-matrix/assessments', [
            'clause_id' => $clause->id, 'document_id' => $doc->id, 'status' => 'gap',
        ]);
        $this->actingAs($complianceAdmin)->patchJson('/api/compliance-matrix/assessments', [
            'clause_id' => $clause->id, 'document_id' => $doc->id, 'status' => 'compliant',
        ]);

        $this->assertDatabaseCount('clause_assessments', 1);
        $this->assertDatabaseHas('clause_assessments', ['clause_id' => $clause->id, 'document_id' => $doc->id, 'status' => 'compliant']);
    }

    public function test_setting_status_to_null_clears_the_assessment(): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');
        $clause = $this->makeClause();
        $doc = $this->makeDocument();
        $this->actingAs($complianceAdmin)->patchJson('/api/compliance-matrix/assessments', [
            'clause_id' => $clause->id, 'document_id' => $doc->id, 'status' => 'partial',
        ]);

        $response = $this->actingAs($complianceAdmin)->patchJson('/api/compliance-matrix/assessments', [
            'clause_id' => $clause->id, 'document_id' => $doc->id, 'status' => null,
        ]);

        $response->assertOk();
        $this->assertTrue($response->json('cleared'));
        $this->assertDatabaseCount('clause_assessments', 0);
    }

    public function test_stats_count_each_status_correctly(): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');
        $clauseA = $this->makeClause(['code' => '4.1']);
        $clauseB = $this->makeClause(['code' => '4.2']);
        $doc = $this->makeDocument();

        $this->actingAs($complianceAdmin)->patchJson('/api/compliance-matrix/assessments', [
            'clause_id' => $clauseA->id, 'document_id' => $doc->id, 'status' => 'compliant',
        ]);
        $this->actingAs($complianceAdmin)->patchJson('/api/compliance-matrix/assessments', [
            'clause_id' => $clauseB->id, 'document_id' => $doc->id, 'status' => 'gap',
        ]);

        $response = $this->actingAs($complianceAdmin)->getJson('/api/compliance-matrix');

        $this->assertSame(2, $response->json('stats.total_cells'));
        $this->assertSame(1, $response->json('stats.compliant'));
        $this->assertSame(1, $response->json('stats.gap'));
        $this->assertSame(0, $response->json('stats.unassessed'));
    }

    public function test_invalid_status_is_rejected(): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');
        $clause = $this->makeClause();
        $doc = $this->makeDocument();

        $this->actingAs($complianceAdmin)->patchJson('/api/compliance-matrix/assessments', [
            'clause_id' => $clause->id, 'document_id' => $doc->id, 'status' => 'tidak_dikenal',
        ])->assertStatus(422);
    }

    public function test_standards_list_reports_clause_counts(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $this->makeClause(['code' => '4.1']);
        $this->makeClause(['code' => '4.2']);
        Standard::create(['code' => 'ISO31000', 'name' => 'ISO 31000', 'active' => true]); // belum punya klausul

        $response = $this->actingAs($controller)->getJson('/api/compliance-matrix');

        $iso9001 = collect($response->json('standards'))->firstWhere('code', 'ISO9001');
        $iso31000 = collect($response->json('standards'))->firstWhere('code', 'ISO31000');
        $this->assertSame(2, $iso9001['clauses_count']);
        $this->assertSame(0, $iso31000['clauses_count']);
    }
}
