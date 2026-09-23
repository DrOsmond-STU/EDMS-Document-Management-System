<?php

namespace Tests\Feature;

use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\Standard;
use App\Models\StandardClause;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** CRUD isi audit (jadwal & checklist), data audit eksternal, dan CRUD klausul standar. */
class AuditContentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $service = app(LicenseService::class);
        $expires = now()->addYear()->toDateString();
        $this->postJson('/api/license/apply', [
            'license_key' => 'EDMS-TEST-0001', 'expires_at' => $expires, 'status' => 'active', 'company_name' => 'PT Uji',
            'signature' => $service->computeSignature('EDMS-TEST-0001', $expires, 'active', 'PT Uji', ''),
        ])->assertOk();
        OrgFunction::create(['id' => 'qa', 'name' => 'QA', 'active' => true]);
        Standard::create(['code' => 'ISO9001', 'name' => 'ISO 9001', 'active' => true]);
    }

    private function user(string $role): User
    {
        Role::firstOrCreate(['id' => $role], ['label' => $role]);
        $u = User::create(['name' => $role, 'email' => "{$role}@example.com", 'password' => 'rahasia-panjang-sekali', 'active' => true, 'must_change_password' => false]);
        $u->roles()->attach($role);

        return $u;
    }

    private function externalAudit(User $auditor): array
    {
        return $this->actingAs($auditor)->postJson('/api/audits', [
            'type' => 'external', 'title' => 'Surveilen ISO 9001', 'audit_kind' => 'surveillance', 'external_body' => 'PT Sertifikasi Indonesia',
            'external_reference' => 'SRT-2026-77', 'planned_start' => now()->addDay()->toDateString(), 'planned_end' => now()->addDays(2)->toDateString(),
            'standards' => ['ISO9001'], 'function_id' => 'qa',
        ])->assertCreated()->json();
    }

    public function test_external_audit_fields_and_session_crud(): void
    {
        $auditor = $this->user('auditor');
        $audit = $this->externalAudit($auditor);
        $this->assertSame('surveillance', $audit['audit_kind']);
        $this->assertSame('PT Sertifikasi Indonesia', $audit['external_body']);

        $this->actingAs($auditor)->patchJson("/api/audits/{$audit['id']}", ['audit_kind' => 'bukan-jenis'])->assertUnprocessable();

        $res = $this->actingAs($auditor)->postJson("/api/audits/{$audit['id']}/sessions", [
            'starts_at' => now()->addDay()->setTime(9, 0)->toDateTimeString(), 'topic' => 'Pengendalian dokumen 7.5', 'function_id' => 'qa', 'auditor' => 'Lead Auditor',
        ])->assertCreated();
        $sessionId = $res->json('sessions.0.id');
        $this->actingAs($auditor)->patchJson("/api/audits/{$audit['id']}/sessions/{$sessionId}", ['topic' => 'Pengendalian informasi terdokumentasi'])
            ->assertOk()->assertJsonPath('sessions.0.topic', 'Pengendalian informasi terdokumentasi');
        $this->actingAs($auditor)->deleteJson("/api/audits/{$audit['id']}/sessions/{$sessionId}")->assertOk()->assertJsonCount(0, 'sessions');
    }

    public function test_checklist_crud_raise_finding_and_lock_after_completion(): void
    {
        $auditor = $this->user('auditor');
        $audit = $this->externalAudit($auditor);
        $base = "/api/audits/{$audit['id']}/checklist";

        $itemId = $this->actingAs($auditor)->postJson($base, ['clause_ref' => 'ISO9001 7.5.3', 'question' => 'Apakah dokumen kedaluwarsa ditarik?'])
            ->assertCreated()->json('checklist.0.id');
        $this->actingAs($auditor)->postJson("{$base}/{$itemId}/finding")->assertUnprocessable(); // belum ada hasil NC

        $this->actingAs($auditor)->patchJson("{$base}/{$itemId}", ['result' => 'nc_minor', 'evidence' => '3 SOP versi lama masih di lantai produksi'])
            ->assertOk()->assertJsonPath('checklist.0.result', 'nc_minor')->assertJsonPath('checklist.0.assessor.name', 'auditor');

        $afterRaise = $this->actingAs($auditor)->postJson("{$base}/{$itemId}/finding")->assertCreated();
        $this->assertNotNull($afterRaise->json('checklist.0.finding_id'));
        $this->assertSame('nc_minor', $afterRaise->json('findings.0.type'));
        $this->assertSame('external', $afterRaise->json('findings.0.audit_source'));
        $this->actingAs($auditor)->postJson("{$base}/{$itemId}/finding")->assertUnprocessable(); // tidak dobel
        $this->actingAs($auditor)->deleteJson("{$base}/{$itemId}")->assertUnprocessable(); // sudah jadi temuan

        $other = $this->actingAs($auditor)->postJson($base, ['question' => 'Butir sementara'])->assertCreated()->json('checklist.1.id');
        $this->actingAs($auditor)->deleteJson("{$base}/{$other}")->assertOk()->assertJsonCount(1, 'checklist');

        $this->actingAs($this->user('viewer'))->postJson($base, ['question' => 'x'])->assertForbidden();

        $this->actingAs($auditor)->postJson("/api/audits/{$audit['id']}/transition", ['action' => 'start'])->assertOk();
        $this->actingAs($auditor)->postJson("/api/audits/{$audit['id']}/transition", ['action' => 'complete'])->assertOk();
        $this->actingAs($auditor)->postJson($base, ['question' => 'Setelah selesai'])->assertUnprocessable();
        $this->actingAs($auditor)->patchJson("{$base}/{$itemId}", ['result' => 'conform'])->assertUnprocessable();
    }

    public function test_standard_clause_crud_with_protection(): void
    {
        $sysadmin = $this->user('sysadmin');
        $base = '/api/master-data/standards/ISO9001/clauses';

        $id = $this->actingAs($sysadmin)->postJson($base, ['code' => '7.5', 'title' => 'Informasi Terdokumentasi'])->assertCreated()->json('id');
        $this->actingAs($sysadmin)->postJson($base, ['code' => '7.5', 'title' => 'Duplikat'])->assertUnprocessable();
        $this->actingAs($sysadmin)->patchJson("{$base}/{$id}", ['title' => 'Informasi Terdokumentasi (ubah)'])->assertOk()->assertJsonPath('title', 'Informasi Terdokumentasi (ubah)');
        $this->actingAs($sysadmin)->getJson($base)->assertOk()->assertJsonPath('clauses.0.code', '7.5');
        $this->actingAs($this->user('viewer'))->postJson($base, ['code' => '8.1', 'title' => 'x'])->assertForbidden();
        $this->actingAs($sysadmin)->patchJson("/api/master-data/standards/ISO14001/clauses/{$id}", ['title' => 'x'])->assertNotFound();
        $this->actingAs($sysadmin)->deleteJson("{$base}/{$id}")->assertOk();
        $this->assertNull(StandardClause::find($id));
    }
}
