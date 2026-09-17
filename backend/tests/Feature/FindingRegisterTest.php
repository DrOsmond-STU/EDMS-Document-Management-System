<?php

namespace Tests\Feature;

use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\Standard;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FindingRegisterTest extends TestCase
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

    private function makeUser(?string $roleId = null): User
    {
        $user = User::create([
            'name' => 'Pengguna '.($roleId ?? 'tanpa-peran'),
            'email' => ($roleId ?? 'norole').'@example.com',
            'password' => 'rahasia-panjang-sekali',
            'active' => true,
            'must_change_password' => false,
        ]);
        if ($roleId) {
            Role::firstOrCreate(['id' => $roleId], ['label' => ucfirst($roleId)]);
            $user->roles()->attach($roleId);
        }

        return $user;
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'type' => 'nc_minor',
            'audit_source' => 'internal',
            'audit_reference' => 'Audit Internal QA — September 2026',
            'clause_reference' => 'ISO 9001 Klausul 8.5.1',
            'title' => 'Rekaman inspeksi tidak lengkap',
            'description' => 'Formulir inspeksi harian tidak diisi lengkap oleh operator shift malam.',
            'evidence' => 'Sampling 10 formulir, 4 tidak lengkap.',
            'owner' => 'Kepala Produksi',
            'raised_by' => 'Tim Audit Internal',
            'due_date' => now()->addDays(14)->toDateString(),
        ], $overrides);
    }

    public function test_user_without_any_relevant_permission_cannot_view(): void
    {
        $this->activateLicense();
        $noRole = $this->makeUser();

        $this->actingAs($noRole)->getJson('/api/findings')->assertStatus(403);
    }

    public function test_viewer_cannot_view_or_create(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');

        $this->actingAs($viewer)->getJson('/api/findings')->assertStatus(403);
        $this->actingAs($viewer)->postJson('/api/findings', $this->payload())->assertStatus(403);
    }

    public function test_auditor_can_view_and_create(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');

        $this->actingAs($auditor)->getJson('/api/findings')->assertOk();
        $response = $this->actingAs($auditor)->postJson('/api/findings', $this->payload());
        $response->assertCreated();
        $this->assertSame('FIND-0001', $response->json('code'));
        $this->assertSame('open', $response->json('status'));
    }

    public function test_codes_increment_sequentially(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');

        $first = $this->actingAs($auditor)->postJson('/api/findings', $this->payload());
        $second = $this->actingAs($auditor)->postJson('/api/findings', $this->payload(['title' => 'Temuan lain']));

        $this->assertSame('FIND-0001', $first->json('code'));
        $this->assertSame('FIND-0002', $second->json('code'));
    }

    public function test_invalid_type_is_rejected(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');

        $this->actingAs($auditor)
            ->postJson('/api/findings', $this->payload(['type' => 'tidak_dikenal']))
            ->assertStatus(422);
    }

    public function test_adding_root_cause_bumps_status_from_open(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');
        $finding = $this->actingAs($auditor)->postJson('/api/findings', $this->payload());

        $response = $this->actingAs($auditor)
            ->postJson("/api/findings/{$finding->json('id')}/root-cause", ['root_cause' => 'SOP tidak disosialisasikan ke shift malam.']);

        $response->assertOk();
        $this->assertSame('root_cause_analysis', $response->json('status'));
    }

    public function test_adding_action_bumps_status_to_capa_in_progress(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');
        $finding = $this->actingAs($auditor)->postJson('/api/findings', $this->payload());

        $response = $this->actingAs($auditor)->postJson("/api/findings/{$finding->json('id')}/actions", [
            'type' => 'corrective', 'description' => 'Sosialisasi ulang SOP ke seluruh shift.', 'pic' => 'Kepala Produksi',
        ]);

        $response->assertCreated();
        $this->assertSame('capa_in_progress', $response->json('status'));
        $this->assertCount(1, $response->json('actions'));
        $this->assertSame('open', $response->json('actions.0.status'));
    }

    public function test_root_cause_does_not_regress_status_once_capa_in_progress(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');
        $finding = $this->actingAs($auditor)->postJson('/api/findings', $this->payload());
        $id = $finding->json('id');

        $this->actingAs($auditor)->postJson("/api/findings/{$id}/actions", [
            'type' => 'corrective', 'description' => 'Tindakan.', 'pic' => 'PIC',
        ]);
        $response = $this->actingAs($auditor)->postJson("/api/findings/{$id}/root-cause", ['root_cause' => 'Akar masalah.']);

        $this->assertSame('capa_in_progress', $response->json('status'));
    }

    public function test_verification_bumps_status_only_from_capa_in_progress(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');
        $finding = $this->actingAs($auditor)->postJson('/api/findings', $this->payload());
        $id = $finding->json('id');

        // Belum ada action — masih 'open', verifikasi tidak boleh mengubah status.
        $stillOpen = $this->actingAs($auditor)->postJson("/api/findings/{$id}/verifications", [
            'method' => 'document_review', 'effective' => false,
        ]);
        $this->assertSame('open', $stillOpen->json('status'));

        $this->actingAs($auditor)->postJson("/api/findings/{$id}/actions", [
            'type' => 'corrective', 'description' => 'Tindakan.', 'pic' => 'PIC',
        ]);
        $response = $this->actingAs($auditor)->postJson("/api/findings/{$id}/verifications", [
            'method' => 'observation', 'effective' => true,
        ]);
        $this->assertSame('verification', $response->json('status'));
        $this->assertCount(2, $response->json('verifications'));
    }

    public function test_finding_manage_role_cannot_close_or_reject(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor'); // finding.manage tapi bukan finding.close
        $finding = $this->actingAs($auditor)->postJson('/api/findings', $this->payload());

        $this->actingAs($auditor)->postJson("/api/findings/{$finding->json('id')}/close")->assertStatus(403);
        $this->actingAs($auditor)->postJson("/api/findings/{$finding->json('id')}/reject", ['reason' => 'x'])->assertStatus(403);
    }

    public function test_close_fails_when_prerequisites_missing(): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');
        $finding = $this->actingAs($complianceAdmin)->postJson('/api/findings', $this->payload());

        $response = $this->actingAs($complianceAdmin)->postJson("/api/findings/{$finding->json('id')}/close");

        $response->assertStatus(422);
        $this->assertStringContainsString('akar masalah', $response->json('message'));
        $this->assertStringContainsString('CAPA', $response->json('message'));
        $this->assertStringContainsString('verifikasi', $response->json('message'));
    }

    public function test_close_succeeds_when_all_prerequisites_met(): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');
        $finding = $this->actingAs($complianceAdmin)->postJson('/api/findings', $this->payload());
        $id = $finding->json('id');

        $this->actingAs($complianceAdmin)->postJson("/api/findings/{$id}/root-cause", ['root_cause' => 'Akar masalah.']);
        $action = $this->actingAs($complianceAdmin)->postJson("/api/findings/{$id}/actions", [
            'type' => 'corrective', 'description' => 'Tindakan.', 'pic' => 'PIC',
        ]);
        $actionId = $action->json('actions.0.id');
        $this->actingAs($complianceAdmin)->patchJson("/api/findings/{$id}/actions/{$actionId}", ['status' => 'completed']);
        $this->actingAs($complianceAdmin)->postJson("/api/findings/{$id}/verifications", [
            'method' => 'document_review', 'effective' => true,
        ]);

        $response = $this->actingAs($complianceAdmin)->postJson("/api/findings/{$id}/close");

        $response->assertOk();
        $this->assertSame('closed', $response->json('status'));
    }

    public function test_reject_requires_reason_and_stores_it(): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');
        $finding = $this->actingAs($complianceAdmin)->postJson('/api/findings', $this->payload());
        $id = $finding->json('id');

        $this->actingAs($complianceAdmin)->postJson("/api/findings/{$id}/reject")->assertStatus(422);

        $response = $this->actingAs($complianceAdmin)->postJson("/api/findings/{$id}/reject", [
            'reason' => 'Duplikat dari temuan FIND-0000, sudah tercatat sebelumnya.',
        ]);
        $response->assertOk();
        $this->assertSame('rejected', $response->json('status'));
        $this->assertSame('Duplikat dari temuan FIND-0000, sudah tercatat sebelumnya.', $response->json('rejection_reason'));
    }

    public function test_closed_finding_cannot_be_modified_further(): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');
        $finding = $this->actingAs($complianceAdmin)->postJson('/api/findings', $this->payload());
        $id = $finding->json('id');
        $this->actingAs($complianceAdmin)->postJson("/api/findings/{$id}/root-cause", ['root_cause' => 'RC']);
        $action = $this->actingAs($complianceAdmin)->postJson("/api/findings/{$id}/actions", [
            'type' => 'corrective', 'description' => 'T', 'pic' => 'PIC',
        ]);
        $this->actingAs($complianceAdmin)->patchJson("/api/findings/{$id}/actions/{$action->json('actions.0.id')}", ['status' => 'completed']);
        $this->actingAs($complianceAdmin)->postJson("/api/findings/{$id}/verifications", ['method' => 'sampling', 'effective' => true]);
        $this->actingAs($complianceAdmin)->postJson("/api/findings/{$id}/close")->assertOk();

        $this->actingAs($complianceAdmin)
            ->postJson("/api/findings/{$id}/root-cause", ['root_cause' => 'Ubah lagi'])
            ->assertStatus(422);
    }

    public function test_standards_are_synced_on_create_and_update(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');
        Standard::create(['code' => 'ISO9001', 'name' => 'ISO 9001', 'active' => true]);
        Standard::create(['code' => 'ISO45001', 'name' => 'ISO 45001', 'active' => true]);

        $created = $this->actingAs($auditor)->postJson('/api/findings', $this->payload(['standards' => ['ISO9001']]));
        $this->assertSame(['ISO9001'], collect($created->json('standards'))->pluck('code')->all());

        $updated = $this->actingAs($auditor)->patchJson("/api/findings/{$created->json('id')}", ['standards' => ['ISO9001', 'ISO45001']]);
        $this->assertEqualsCanonicalizing(['ISO9001', 'ISO45001'], collect($updated->json('standards'))->pluck('code')->all());
    }

    public function test_filters_by_source_type_status_and_function(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');
        $fn = OrgFunction::create(['id' => 'qa', 'name' => 'Quality Assurance', 'active' => true]);

        $this->actingAs($auditor)->postJson('/api/findings', $this->payload(['audit_source' => 'internal', 'function_id' => $fn->id]));
        $this->actingAs($auditor)->postJson('/api/findings', $this->payload(['title' => 'Temuan eksternal', 'audit_source' => 'external', 'type' => 'ofi']));

        $bySource = $this->actingAs($auditor)->getJson('/api/findings?audit_source=external');
        $this->assertCount(1, $bySource->json('findings'));

        $byType = $this->actingAs($auditor)->getJson('/api/findings?type=ofi');
        $this->assertCount(1, $byType->json('findings'));

        $byFunction = $this->actingAs($auditor)->getJson("/api/findings?function_id={$fn->id}");
        $this->assertCount(1, $byFunction->json('findings'));

        $byStatus = $this->actingAs($auditor)->getJson('/api/findings?status=open');
        $this->assertCount(2, $byStatus->json('findings'));
    }
}
