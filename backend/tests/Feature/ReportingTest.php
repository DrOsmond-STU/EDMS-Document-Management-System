<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\ClauseAssessment;
use App\Models\Document;
use App\Models\DraftingProject;
use App\Models\Finding;
use App\Models\OrgFunction;
use App\Models\Risk;
use App\Models\Role;
use App\Models\Standard;
use App\Models\StandardClause;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportingTest extends TestCase
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

    private function doc(string $code, array $attrs = []): Document
    {
        OrgFunction::firstOrCreate(['id' => 'qa'], ['name' => 'QA', 'active' => true]);

        return Document::create(array_merge([
            'code' => $code, 'title' => $code, 'type' => 'SOP', 'function_id' => 'qa', 'classification' => 'internal',
            'status' => 'released', 'validity' => 'berlaku', 'version' => '1.0', 'revision_number' => 0,
        ], $attrs));
    }

    private function kpi(array $kpis, string $key): array
    {
        return collect($kpis)->firstWhere('key', $key);
    }

    public function test_requires_reporting_view(): void
    {
        $this->activateLicense();
        $this->actingAs($this->makeUser('viewer'))->getJson('/api/reporting/kpi')->assertStatus(403);
        $this->actingAs($this->makeUser('controller'))->getJson('/api/reporting/kpi')->assertOk();
    }

    public function test_empty_system_reports_na_instead_of_invented_numbers(): void
    {
        $this->activateLicense();
        $kpis = $this->actingAs($this->makeUser('controller'))->getJson('/api/reporting/kpi')->json('kpis');

        $this->assertSame('na', $this->kpi($kpis, 'approval_cycle')['status']);
        $this->assertNull($this->kpi($kpis, 'approval_cycle')['value']);
        $this->assertSame('na', $this->kpi($kpis, 'distribution_ack')['status']);
        $this->assertSame('na', $this->kpi($kpis, 'ai_adoption')['status']);
        $this->assertCount(8, $kpis);
    }

    public function test_approval_cycle_excludes_drafting_origin_documents(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $a = $this->doc('SOP-QA-001', ['effective_date' => now()->toDateString()]);
        $a->created_at = now()->subDays(10); $a->save();
        $b = $this->doc('SOP-QA-002', ['effective_date' => now()->toDateString()]);
        $b->created_at = now()->subDays(20); $b->save();
        $fromDrafting = $this->doc('SOP-QA-003', ['effective_date' => now()->toDateString()]); // 0 hari, tapi dikecualikan
        DraftingProject::create([
            'code' => 'REQ-X-001', 'title' => 'x', 'doc_type' => 'SOP', 'function_id' => 'qa', 'classification' => 'internal',
            'reason' => 'x', 'requester_id' => $controller->id, 'status' => 'ratified', 'document_id' => $fromDrafting->id,
        ]);

        $kpi = $this->kpi($this->actingAs($controller)->getJson('/api/reporting/kpi')->json('kpis'), 'approval_cycle');

        $this->assertEquals(15.0, $kpi['value']);
        $this->assertSame('warn', $kpi['status']); // 15 hari > target 14
    }

    public function test_compliance_coverage_counts_distinct_compliant_clauses(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        Standard::create(['code' => 'ISO9001', 'name' => 'ISO 9001', 'active' => true]);
        $c1 = StandardClause::create(['standard_code' => 'ISO9001', 'code' => '4.1', 'title' => 'a', 'sort_order' => 0]);
        StandardClause::create(['standard_code' => 'ISO9001', 'code' => '4.2', 'title' => 'b', 'sort_order' => 1]);
        $d1 = $this->doc('SOP-QA-001');
        $d2 = $this->doc('SOP-QA-002');
        ClauseAssessment::create(['clause_id' => $c1->id, 'document_id' => $d1->id, 'status' => 'compliant']);
        ClauseAssessment::create(['clause_id' => $c1->id, 'document_id' => $d2->id, 'status' => 'compliant']);

        $kpi = $this->kpi($this->actingAs($controller)->getJson('/api/reporting/kpi')->json('kpis'), 'compliance_coverage');

        $this->assertEquals(50.0, $kpi['value']); // 1 dari 2 klausul, walau 2 dokumen menaunginya
    }

    public function test_overdue_reviews_utilization_and_security_indicator(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $this->doc('SOP-QA-001', ['review_date' => now()->subDay()->toDateString()]);
        $this->doc('SOP-QA-002', ['review_date' => now()->addMonth()->toDateString()]);
        foreach (['view', 'view', 'download'] as $action) {
            AuditLog::create(['actor_name' => 'x', 'action' => $action, 'entity' => 'DocumentFile', 'entity_label' => 'SOP-QA-001', 'detail' => '']);
        }
        AuditLog::create(['actor_name' => 'x', 'action' => 'login_failed', 'entity' => 'Session', 'detail' => '']);

        $response = $this->actingAs($controller)->getJson('/api/reporting/kpi');
        $kpis = $response->json('kpis');

        $this->assertSame(1, $this->kpi($kpis, 'overdue_reviews')['value']);
        $this->assertSame(3, $this->kpi($kpis, 'document_utilization')['value']);
        $this->assertSame(1, $this->kpi($kpis, 'security_indicator')['value']);
        $this->assertSame('SOP-QA-001', $response->json('top_documents.0.code'));
        $this->assertEquals(3, $response->json('top_documents.0.hits'));
    }

    public function test_governance_kpis_from_real_module_data(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        Finding::create(['code' => 'FIND-0001', 'type' => 'nc_minor', 'status' => 'closed', 'audit_source' => 'internal', 'title' => 'a']);
        Finding::create(['code' => 'FIND-0002', 'type' => 'nc_minor', 'status' => 'open', 'audit_source' => 'internal', 'title' => 'b', 'due_date' => now()->subDay()->toDateString()]);
        foreach (['high', 'low', 'low', 'low'] as $i => $level) {
            Risk::create(['code' => "RISK-000{$i}", 'title' => 'r', 'category' => 'operational', 'inherent_likelihood' => 3, 'inherent_impact' => 3,
                'inherent_level' => 'moderate', 'residual_likelihood' => 2, 'residual_impact' => 2, 'residual_level' => $level, 'treatment' => 'reduce', 'status' => 'monitored']);
        }

        $gov = $this->actingAs($controller)->getJson('/api/reporting/kpi')->json('governance');

        $this->assertEquals(50.0, $this->kpi($gov, 'capa_closure')['value']);
        $this->assertSame(1, $this->kpi($gov, 'capa_overdue')['value']);
        $this->assertEquals(25.0, $this->kpi($gov, 'risk_high')['value']);
        $this->assertSame('na', $this->kpi($gov, 'audit_programme')['status']);
    }

    public function test_monthly_trend_has_twelve_months_and_counts_released(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $this->doc('SOP-QA-001', ['effective_date' => now()->startOfYear()->addDays(40)->toDateString()]); // Februari

        $monthly = $this->actingAs($controller)->getJson('/api/reporting/kpi')->json('monthly');

        $this->assertCount(12, $monthly);
        $this->assertSame(1, $monthly[1]['released']);
    }

    public function test_csv_export_contains_all_kpis(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');

        $response = $this->actingAs($controller)->get('/api/reporting/kpi.csv');

        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));
        $csv = $response->streamedContent();
        $this->assertStringContainsString('Cakupan kepatuhan klausul', $csv);
        $this->assertStringContainsString('Penutupan temuan/CAPA', $csv);
        $this->assertSame(1 + 8 + 8, count(array_filter(explode("\n", trim($csv)))));
    }

    public function test_future_year_is_clamped_to_current_year(): void
    {
        $this->activateLicense();
        $response = $this->actingAs($this->makeUser('controller'))->getJson('/api/reporting/kpi?year=2999');

        $this->assertSame((int) now()->format('Y'), $response->json('year'));
    }
}
