<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Document;
use App\Models\OrgFunction;
use App\Models\Risk;
use App\Models\Role;
use App\Models\Standard;
use App\Models\StandardClause;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * CRUD lengkap: ubah & hapus di setiap register. Hapus = soft delete (data
 * hilang dari tampilan, jejaknya tetap di database & Audit Trail), dengan
 * aturan kapan sebuah baris BOLEH dihapus.
 */
class CrudDeleteTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $service = app(LicenseService::class);
        $expires = now()->addYear()->toDateString();
        $this->postJson('/api/license/apply', [
            'license_key' => 'EDMS-TEST-0001', 'expires_at' => $expires, 'status' => 'active', 'company_name' => 'PT Uji',
            'signature' => $service->computeSignature('EDMS-TEST-0001', $expires, 'active', 'PT Uji', ''),
        ])->assertOk();
        OrgFunction::create(['id' => 'hse', 'name' => 'HSE', 'active' => true]);
        Standard::create(['code' => 'ISO9001', 'name' => 'ISO 9001', 'active' => true]);
        $this->admin = $this->makeUser('compliance_admin');
    }

    private function makeUser(string $roleId): User
    {
        Role::firstOrCreate(['id' => $roleId], ['label' => ucfirst($roleId)]);
        $user = User::create([
            'name' => 'Pengguna '.$roleId, 'email' => $roleId.'@example.com', 'password' => 'rahasia-panjang-sekali',
            'active' => true, 'must_change_password' => false, 'function_id' => null,
        ]);
        $user->roles()->attach($roleId);

        return $user;
    }

    private function as(User $user): self
    {
        return $this->actingAs($user);
    }

    public function test_risk_update_delete_and_code_is_not_reused(): void
    {
        $payload = ['title' => 'Kebakaran gudang', 'category' => 'safety', 'treatment' => 'reduce',
            'inherent_likelihood' => 3, 'inherent_impact' => 4, 'residual_likelihood' => 2, 'residual_impact' => 2];
        $risk = $this->as($this->admin)->postJson('/api/risks', $payload)->assertCreated()->json();
        $this->as($this->admin)->patchJson("/api/risks/{$risk['id']}", ['title' => 'Kebakaran gudang B3'])->assertOk()
            ->assertJsonPath('title', 'Kebakaran gudang B3');

        $control = $this->as($this->admin)->postJson("/api/risks/{$risk['id']}/controls", ['description' => 'APAR'])->assertCreated()->json();
        $this->as($this->admin)->patchJson("/api/risks/{$risk['id']}/controls/{$control['id']}", ['description' => 'APAR 6 kg'])->assertOk()
            ->assertJsonPath('description', 'APAR 6 kg');
        $this->as($this->admin)->deleteJson("/api/risks/{$risk['id']}/controls/{$control['id']}")->assertOk();

        $viewer = $this->makeUser('viewer');
        $this->as($viewer)->deleteJson("/api/risks/{$risk['id']}")->assertForbidden();
        $this->as($this->admin)->deleteJson("/api/risks/{$risk['id']}")->assertOk();

        $this->assertSame(0, collect($this->as($this->admin)->getJson('/api/risks')->json('risks'))->where('id', $risk['id'])->count());
        $this->assertSoftDeleted('risks', ['id' => $risk['id']]);
        $this->assertTrue(AuditLog::where('action', 'delete')->where('entity', 'Risk')->exists());

        $next = $this->as($this->admin)->postJson('/api/risks', $payload)->assertCreated()->json('code');
        $this->assertNotSame($risk['code'], $next, 'Nomor risiko yang dihapus tidak boleh dipakai ulang.');
    }

    public function test_record_series_and_records_delete_rules(): void
    {
        $series = $this->as($this->admin)->postJson('/api/record-series', [
            'code' => 'REK-PLT', 'name' => 'Pelatihan', 'retention_active_years' => 1, 'retention_inactive_years' => 1, 'disposition' => 'destroy',
        ])->assertCreated()->json();
        $record = $this->as($this->admin)->postJson('/api/records', [
            'series_id' => $series['id'], 'title' => 'Daftar hadir', 'record_date' => now()->toDateString(), 'medium' => 'physical',
        ])->assertCreated()->json();

        $this->as($this->admin)->deleteJson("/api/record-series/{$series['id']}")->assertStatus(422);

        $this->as($this->admin)->postJson("/api/records/{$record['id']}/action", ['action' => 'hold', 'reason' => 'Sengketa'])->assertOk();
        $this->as($this->admin)->deleteJson("/api/records/{$record['id']}")->assertStatus(422);
        $this->as($this->admin)->postJson("/api/records/{$record['id']}/action", ['action' => 'release'])->assertOk();
        $this->as($this->admin)->deleteJson("/api/records/{$record['id']}")->assertOk();

        $this->as($this->admin)->deleteJson("/api/record-series/{$series['id']}")->assertOk();
        $this->assertSoftDeleted('record_series', ['id' => $series['id']]);
    }

    public function test_legal_requirement_delete(): void
    {
        $item = $this->as($this->admin)->postJson('/api/legal-requirements', [
            'title' => 'PP 22/2021', 'regulation_type' => 'pp', 'category' => 'lingkungan',
        ])->assertCreated()->json();
        $this->as($this->makeUser('viewer'))->deleteJson("/api/legal-requirements/{$item['id']}")->assertForbidden();
        $this->as($this->admin)->deleteJson("/api/legal-requirements/{$item['id']}")->assertOk();
        $this->as($this->admin)->getJson("/api/legal-requirements")->assertOk()->assertJsonMissing(['code' => $item['code']]);
    }

    public function test_audit_with_findings_or_completed_cannot_be_deleted(): void
    {
        $payload = ['type' => 'internal', 'title' => 'Audit QMS', 'planned_start' => now()->addDay()->toDateString(), 'planned_end' => now()->addDays(2)->toDateString()];
        $audit = $this->as($this->admin)->postJson('/api/audits', $payload)->assertCreated()->json();
        $finding = $this->as($this->admin)->postJson('/api/findings', [
            'type' => 'ofi', 'audit_source' => 'internal', 'title' => 'Temuan', 'audit_id' => $audit['id'],
        ])->assertCreated()->json();

        $this->as($this->admin)->deleteJson("/api/audits/{$audit['id']}")->assertStatus(422);
        $this->as($this->admin)->deleteJson("/api/findings/{$finding['id']}")->assertOk();
        $this->as($this->admin)->deleteJson("/api/audits/{$audit['id']}")->assertOk();

        $done = $this->as($this->admin)->postJson('/api/audits', $payload)->assertCreated()->json();
        $this->as($this->admin)->postJson("/api/audits/{$done['id']}/transition", ['action' => 'start'])->assertOk();
        $this->as($this->admin)->postJson("/api/audits/{$done['id']}/transition", ['action' => 'complete', 'summary' => 'OK'])->assertOk();
        $this->as($this->admin)->deleteJson("/api/audits/{$done['id']}")->assertStatus(422);
    }

    public function test_mgmt_review_action_edit_and_delete_rules(): void
    {
        $review = $this->as($this->admin)->postJson('/api/mgmt-reviews', ['title' => 'MR 2026', 'meeting_date' => now()->toDateString()])->assertCreated()->json();
        $action = $this->as($this->admin)->postJson("/api/mgmt-reviews/{$review['id']}/actions", ['description' => 'Tambah APAR'])->assertCreated()->json();

        $this->as($this->admin)->patchJson("/api/mgmt-reviews/{$review['id']}/actions/{$action['id']}", ['description' => 'Tambah 4 APAR', 'pic' => 'HSE'])
            ->assertOk()->assertJsonPath('pic', 'HSE');
        $this->as($this->admin)->deleteJson("/api/mgmt-reviews/{$review['id']}/actions/{$action['id']}")->assertOk();

        $this->as($this->admin)->patchJson("/api/mgmt-reviews/{$review['id']}", ['decisions' => 'Lanjut'])->assertOk();
        $this->as($this->admin)->postJson("/api/mgmt-reviews/{$review['id']}/transition", ['action' => 'complete'])->assertOk();
        $this->as($this->admin)->deleteJson("/api/mgmt-reviews/{$review['id']}")->assertStatus(422);

        $other = $this->as($this->admin)->postJson('/api/mgmt-reviews', ['title' => 'MR salah input', 'meeting_date' => now()->toDateString()])->assertCreated()->json();
        $this->as($this->admin)->deleteJson("/api/mgmt-reviews/{$other['id']}")->assertOk();
    }

    public function test_finding_capa_delete_resets_status_and_verified_finding_is_protected(): void
    {
        $finding = $this->as($this->admin)->postJson('/api/findings', ['type' => 'nc_minor', 'audit_source' => 'internal', 'title' => 'Formulir tidak lengkap'])->assertCreated()->json();
        $withAction = $this->as($this->admin)->postJson("/api/findings/{$finding['id']}/actions", ['type' => 'corrective', 'description' => 'Latih ulang', 'pic' => 'QA'])->assertCreated()->json();
        $this->assertSame('capa_in_progress', $withAction['status']);
        $actionId = $withAction['actions'][0]['id'];

        $this->as($this->admin)->patchJson("/api/findings/{$finding['id']}/actions/{$actionId}", ['description' => 'Latih ulang operator shift malam'])->assertOk();
        $after = $this->as($this->admin)->deleteJson("/api/findings/{$finding['id']}/actions/{$actionId}")->assertOk()->json();
        $this->assertSame('open', $after['status']);

        $this->as($this->admin)->postJson("/api/findings/{$finding['id']}/verifications", ['method' => 'document_review', 'effective' => true])->assertStatus(201);
        $this->as($this->admin)->deleteJson("/api/findings/{$finding['id']}")->assertStatus(422);
    }

    public function test_drafting_request_edit_and_delete_by_requester_only_before_work(): void
    {
        $requester = $this->makeUser('requester');
        $project = $this->as($requester)->postJson('/api/drafting-projects', [
            'title' => 'Prosedur Hot Work', 'doc_type' => 'SOP', 'function_id' => 'hse', 'classification' => 'internal', 'reason' => 'Audit',
        ])->assertCreated()->json();

        $this->as($requester)->patchJson("/api/drafting-projects/{$project['id']}", ['title' => 'Prosedur Izin Kerja Panas', 'standards' => ['ISO9001']])
            ->assertOk()->assertJsonPath('title', 'Prosedur Izin Kerja Panas');
        $this->as($this->makeUser('drafter'))->deleteJson("/api/drafting-projects/{$project['id']}")->assertForbidden();
        $this->as($requester)->deleteJson("/api/drafting-projects/{$project['id']}")->assertOk();
        $this->as($requester)->getJson("/api/drafting-projects/{$project['id']}")->assertNotFound();
    }

    public function test_master_data_delete_only_when_unused(): void
    {
        $sysadmin = $this->makeUser('sysadmin');
        OrgFunction::create(['id' => 'kosong', 'name' => 'Tidak Dipakai', 'active' => true]);
        Document::create(['code' => 'SOP-HSE-001', 'title' => 'X', 'type' => 'SOP', 'function_id' => 'hse', 'classification' => 'internal',
            'status' => 'draft', 'validity' => 'belum_berlaku', 'version' => '0.1', 'revision_number' => 0]);

        $this->as($sysadmin)->deleteJson('/api/master-data/org-functions/hse')->assertStatus(422);
        $this->as($sysadmin)->deleteJson('/api/master-data/org-functions/kosong')->assertOk();
        $this->assertNull(OrgFunction::find('kosong'));

        Standard::create(['code' => 'ISO22301', 'name' => 'ISO 22301', 'active' => true]);
        StandardClause::create(['standard_code' => 'ISO22301', 'code' => '4.1', 'title' => 'Konteks', 'sort_order' => 1]);
        Risk::create(['code' => 'RISK-0009', 'title' => 'R', 'category' => 'safety', 'inherent_likelihood' => 1, 'inherent_impact' => 1, 'inherent_level' => 'low',
            'residual_likelihood' => 1, 'residual_impact' => 1, 'residual_level' => 'low', 'treatment' => 'accept', 'status' => 'identified'])
            ->standards()->attach('ISO9001');

        $this->as($sysadmin)->deleteJson('/api/master-data/standards/ISO9001')->assertStatus(422);
        $this->as($sysadmin)->deleteJson('/api/master-data/standards/ISO22301')->assertOk();
        $this->assertSame(0, StandardClause::where('standard_code', 'ISO22301')->count());
    }

    public function test_user_delete_revokes_access_frees_email_and_keeps_name(): void
    {
        $sysadmin = $this->makeUser('sysadmin');
        $target = $this->makeUser('drafter');

        $this->as($sysadmin)->deleteJson("/api/users/{$sysadmin->id}")->assertStatus(422);
        $this->as($sysadmin)->deleteJson("/api/users/{$target->id}")->assertOk();

        $target->refresh();
        $this->assertFalse($target->active);
        $this->assertNotNull($target->deleted_at);
        $this->assertSame('Pengguna drafter', $target->name);
        $this->assertCount(0, $target->roles);
        $this->as($sysadmin)->getJson('/api/users')->assertOk()->assertJsonMissing(['id' => $target->id, 'name' => 'Pengguna drafter']);
        $this->as($sysadmin)->patchJson("/api/users/{$target->id}", ['name' => 'Hidup lagi'])->assertNotFound();

        $login = $this->postJson('/api/auth/login', ['email' => 'drafter@example.com', 'password' => 'rahasia-panjang-sekali']);
        $this->assertContains($login->status(), [401, 422], 'Akun yang dihapus tidak boleh bisa login.');
        $this->assertNotSame('drafter@example.com', $target->email);
    }
}
