<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Document;
use App\Models\DocumentRelation;
use App\Models\Finding;
use App\Models\OrgFunction;
use App\Models\Risk;
use App\Models\Role;
use App\Models\Standard;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class KnowledgeTest extends TestCase
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

    private function doc(string $code, string $title, array $attrs = []): Document
    {
        OrgFunction::firstOrCreate(['id' => 'hse'], ['name' => 'HSE', 'active' => true]);
        OrgFunction::firstOrCreate(['id' => 'qa'], ['name' => 'QA', 'active' => true]);
        $status = $attrs['status'] ?? 'released';

        return Document::create(array_merge([
            'code' => $code, 'title' => $title, 'type' => 'SOP', 'function_id' => 'hse', 'classification' => 'internal',
            'status' => $status, 'validity' => $status === 'released' ? 'berlaku' : 'belum_berlaku', 'version' => '1.0', 'revision_number' => 0,
        ], $attrs));
    }

    private function risk(string $title): Risk
    {
        return Risk::create(['code' => 'RISK-0001', 'title' => $title, 'category' => 'safety', 'inherent_likelihood' => 3, 'inherent_impact' => 4,
            'inherent_level' => 'high', 'residual_likelihood' => 2, 'residual_impact' => 3, 'residual_level' => 'moderate', 'treatment' => 'reduce', 'status' => 'treated']);
    }

    private function group(array $groups, string $type): ?array
    {
        return collect($groups)->firstWhere('type', $type);
    }

    public function test_short_query_returns_nothing(): void
    {
        $this->activateLicense();
        $this->actingAs($this->makeUser('viewer'))->getJson('/api/search?q=a')->assertOk()->assertJsonPath('total', 0);
    }

    public function test_search_spans_modules_the_user_may_see(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller'); // melihat risiko & temuan
        $this->doc('SOP-HSE-001', 'Pekerjaan Panas dan Pengelasan');
        $this->risk('Kebakaran akibat pekerjaan panas');
        Finding::create(['code' => 'FIND-0001', 'type' => 'nc_minor', 'status' => 'open', 'audit_source' => 'internal', 'title' => 'Izin pekerjaan panas tidak diarsip']);

        $groups = $this->actingAs($controller)->getJson('/api/search?q=pekerjaan panas')->json('groups');

        $this->assertNotNull($this->group($groups, 'document'));
        $this->assertNotNull($this->group($groups, 'risk'));
        $this->assertNotNull($this->group($groups, 'finding'));
    }

    public function test_search_never_leaks_drafts_or_forbidden_modules(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer'); // tidak boleh melihat draft maupun temuan
        $this->doc('SOP-HSE-001', 'Pekerjaan panas (rilis)');
        $this->doc('SOP-HSE-002', 'Pekerjaan panas (draft rahasia)', ['status' => 'draft']);
        Finding::create(['code' => 'FIND-0001', 'type' => 'nc_major', 'status' => 'open', 'audit_source' => 'internal', 'title' => 'Pekerjaan panas tanpa izin']);

        $groups = $this->actingAs($viewer)->getJson('/api/search?q=pekerjaan panas')->json('groups');

        $docs = $this->group($groups, 'document')['items'];
        $this->assertCount(1, $docs);
        $this->assertSame('SOP-HSE-001', $docs[0]['code']);
        $this->assertNull($this->group($groups, 'finding'));
    }

    public function test_exact_code_ranks_above_title_match_and_snippet_comes_from_content(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $this->doc('WI-QA-010', 'Kalibrasi alat ukur', ['function_id' => 'qa', 'content' => 'Instruksi ini merujuk ke SOP-QA-007 untuk jadwal kalibrasi tahunan.']);
        $this->doc('SOP-QA-007', 'Pengendalian Alat Ukur', ['function_id' => 'qa']);

        $items = $this->group($this->actingAs($controller)->getJson('/api/search?q=SOP-QA-007')->json('groups'), 'document')['items'];

        $this->assertSame('SOP-QA-007', $items[0]['code']);
        $this->assertSame('WI-QA-010', $items[1]['code']);
        $this->assertStringContainsString('SOP-QA-007', $items[1]['snippet']);
    }

    public function test_like_wildcards_in_query_are_treated_literally(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $this->doc('SOP-QA-001', 'Diskon 100% produk');
        $this->doc('SOP-QA-002', 'Produk biasa');

        $items = $this->group($this->actingAs($controller)->getJson('/api/search?q='.urlencode('100%'))->json('groups'), 'document')['items'];
        $this->assertCount(1, $items);
    }

    public function test_related_documents_rank_explicit_relation_and_shared_standards(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        Standard::create(['code' => 'ISO45001', 'name' => 'ISO 45001', 'active' => true]);
        $base = $this->doc('SOP-HSE-001', 'Izin Kerja Panas', ['keywords' => ['pengelasan']]);
        $base->standards()->sync(['ISO45001']);
        $linked = $this->doc('FRM-HSE-001', 'Formulir Izin', ['function_id' => 'qa']);
        DocumentRelation::create(['document_id' => $base->id, 'type' => 'references', 'target_document_id' => $linked->id]);
        $sameStd = $this->doc('SOP-HSE-002', 'APD', ['function_id' => 'qa', 'keywords' => ['pengelasan']]);
        $sameStd->standards()->sync(['ISO45001']);
        $sameFunction = $this->doc('SOP-HSE-003', 'P3K');
        $unrelated = $this->doc('SOP-QA-009', 'Tidak terkait', ['function_id' => 'qa']);
        $hiddenDraft = $this->doc('SOP-HSE-004', 'Draft', ['status' => 'draft']);

        $viewer = $this->makeUser('viewer');
        $related = $this->actingAs($viewer)->getJson("/api/documents/{$base->id}/related")->json('related');
        $ids = array_column($related, 'id');

        $this->assertSame($linked->id, $ids[0]);
        $this->assertSame($sameStd->id, $ids[1]);
        $this->assertContains($sameFunction->id, $ids);
        $this->assertNotContains($unrelated->id, $ids);
        $this->assertNotContains($hiddenDraft->id, $ids);
        $this->assertContains('kata kunci pengelasan', $related[1]['reasons']);
    }

    public function test_overview_counts_visible_released_documents_and_popular(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');
        Standard::create(['code' => 'ISO45001', 'name' => 'ISO 45001', 'active' => true]);
        $a = $this->doc('SOP-HSE-001', 'A', ['effective_date' => now()->toDateString()]);
        $a->standards()->sync(['ISO45001']);
        $draft = $this->doc('SOP-HSE-002', 'B', ['status' => 'draft']);
        $draft->standards()->sync(['ISO45001']);
        AuditLog::create(['actor_name' => 'x', 'action' => 'view', 'entity' => 'DocumentFile', 'entity_label' => 'SOP-HSE-002', 'detail' => '']);
        AuditLog::create(['actor_name' => 'x', 'action' => 'view', 'entity' => 'DocumentFile', 'entity_label' => 'SOP-HSE-001', 'detail' => '']);

        $o = $this->actingAs($viewer)->getJson('/api/knowledge/overview')->json();

        $this->assertSame(1, $o['totals']['released']);
        $this->assertSame(1, $o['by_standard'][0]['documents_count']);
        $this->assertSame(['SOP-HSE-001'], array_column($o['popular'], 'code')); // draft yang populer tidak ikut
    }
}
