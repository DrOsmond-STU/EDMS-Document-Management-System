<?php

namespace Tests\Feature;

use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\Standard;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditTest extends TestCase
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

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'type' => 'internal',
            'title' => 'Audit Internal QMS Semester 1',
            'objective' => 'Menilai kesesuaian terhadap ISO 9001:2015.',
            'scope' => 'Proses produksi & pengadaan.',
            'planned_start' => now()->addDays(7)->toDateString(),
            'planned_end' => now()->addDays(9)->toDateString(),
        ], $overrides);
    }

    public function test_viewer_without_audit_view_is_forbidden(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('drafter');

        $this->actingAs($viewer)->getJson('/api/audits')->assertStatus(403);
    }

    public function test_only_audit_plan_can_schedule_an_audit(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');
        $reviewer = $this->makeUser('reviewer');

        $this->actingAs($reviewer)->postJson('/api/audits', $this->payload())->assertStatus(403);

        $response = $this->actingAs($auditor)->postJson('/api/audits', $this->payload());
        $response->assertCreated();
        $this->assertSame('planned', $response->json('status'));
        $this->assertStringStartsWith('AUD-INT-', $response->json('code'));
    }

    public function test_external_audit_gets_its_own_code_sequence(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');

        $this->actingAs($auditor)->postJson('/api/audits', $this->payload(['type' => 'internal']))->assertCreated();
        $response = $this->actingAs($auditor)->postJson('/api/audits', $this->payload(['type' => 'external']));

        $response->assertCreated();
        $this->assertStringStartsWith('AUD-EXT-0001', $response->json('code'));
    }

    public function test_full_lifecycle_start_then_complete(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');
        $audit = $this->actingAs($auditor)->postJson('/api/audits', $this->payload())->json();

        $this->actingAs($auditor)->postJson("/api/audits/{$audit['id']}/transition", ['action' => 'start'])
            ->assertOk()
            ->assertJsonPath('status', 'in_progress');

        $response = $this->actingAs($auditor)->postJson("/api/audits/{$audit['id']}/transition", [
            'action' => 'complete', 'summary' => 'Tidak ditemukan ketidaksesuaian mayor.',
        ]);
        $response->assertOk();
        $this->assertSame('completed', $response->json('status'));
        $this->assertSame('Tidak ditemukan ketidaksesuaian mayor.', $response->json('summary'));
        $this->assertNotNull($response->json('actual_start'));
        $this->assertNotNull($response->json('actual_end'));
    }

    public function test_cannot_complete_an_audit_that_has_not_started(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');
        $audit = $this->actingAs($auditor)->postJson('/api/audits', $this->payload())->json();

        $this->actingAs($auditor)->postJson("/api/audits/{$audit['id']}/transition", ['action' => 'complete'])
            ->assertStatus(422);
    }

    public function test_completed_audit_cannot_be_edited(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');
        $audit = $this->actingAs($auditor)->postJson('/api/audits', $this->payload())->json();
        $this->actingAs($auditor)->postJson("/api/audits/{$audit['id']}/transition", ['action' => 'start']);
        $this->actingAs($auditor)->postJson("/api/audits/{$audit['id']}/transition", ['action' => 'complete']);

        $this->actingAs($auditor)->patchJson("/api/audits/{$audit['id']}", ['title' => 'Judul Baru'])
            ->assertStatus(422);
    }

    public function test_cancel_requires_audit_plan_not_audit_conduct(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor'); // punya audit.plan & audit.conduct
        $controller = $this->makeUser('controller'); // tidak punya keduanya untuk audit
        $audit = $this->actingAs($auditor)->postJson('/api/audits', $this->payload())->json();

        $this->actingAs($controller)->postJson("/api/audits/{$audit['id']}/transition", ['action' => 'cancel'])
            ->assertStatus(403);

        $this->actingAs($auditor)->postJson("/api/audits/{$audit['id']}/transition", ['action' => 'cancel'])
            ->assertOk()
            ->assertJsonPath('status', 'cancelled');
    }

    public function test_standards_and_function_and_lead_auditor_are_attached(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');
        $fn = OrgFunction::create(['id' => 'qa', 'name' => 'Quality Assurance', 'active' => true]);
        Standard::create(['code' => 'ISO9001', 'name' => 'ISO 9001', 'active' => true]);

        $response = $this->actingAs($auditor)->postJson('/api/audits', $this->payload([
            'function_id' => $fn->id,
            'lead_auditor_id' => $auditor->id,
            'standards' => ['ISO9001'],
        ]));

        $response->assertCreated();
        $this->assertSame('qa', $response->json('function_id'));
        $this->assertSame($auditor->id, $response->json('lead_auditor_id'));
        $this->assertCount(1, $response->json('standards'));
    }

    public function test_findings_can_be_linked_to_an_audit(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');
        $audit = $this->actingAs($auditor)->postJson('/api/audits', $this->payload())->json();

        $response = $this->actingAs($auditor)->postJson('/api/findings', [
            'type' => 'nc_minor',
            'audit_source' => 'internal',
            'audit_id' => $audit['id'],
            'title' => 'Rekaman pelatihan tidak lengkap',
        ]);

        $response->assertCreated();
        $this->assertSame($audit['id'], $response->json('audit_id'));
        $this->assertSame($audit['code'], $response->json('audit.code'));

        $list = $this->actingAs($auditor)->getJson('/api/audits')->json('audits');
        $this->assertCount(1, collect($list)->firstWhere('id', $audit['id'])['findings']);
    }

    public function test_filter_by_type_and_status(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');
        $this->actingAs($auditor)->postJson('/api/audits', $this->payload(['type' => 'internal']));
        $this->actingAs($auditor)->postJson('/api/audits', $this->payload(['type' => 'external']));

        $response = $this->actingAs($auditor)->getJson('/api/audits?type=external');
        $audits = $response->json('audits');
        $this->assertCount(1, $audits);
        $this->assertSame('external', $audits[0]['type']);
    }
}
