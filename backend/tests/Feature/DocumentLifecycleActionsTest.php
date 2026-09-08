<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentLifecycleActionsTest extends TestCase
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

    private function makeFunction(): OrgFunction
    {
        return OrgFunction::firstOrCreate(['id' => 'qa'], ['name' => 'Quality Assurance', 'active' => true]);
    }

    private function makeDocument(string $status = 'draft', array $overrides = []): Document
    {
        $fn = $this->makeFunction();

        return Document::create(array_merge([
            'code' => 'SOP-QA-'.random_int(100, 999),
            'title' => 'Dokumen Uji',
            'type' => 'SOP',
            'function_id' => $fn->id,
            'classification' => 'internal',
            'status' => $status,
            'validity' => $status === 'released' ? 'berlaku' : 'belum_berlaku',
            'version' => '1.0',
            'revision_number' => 0,
        ], $overrides));
    }

    // --- Delete ---

    public function test_controller_can_delete_draft_document(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $document = $this->makeDocument('draft');

        $response = $this->actingAs($controller)->deleteJson("/api/documents/{$document->id}");

        $response->assertOk();
        $this->assertSoftDeleted('documents', ['id' => $document->id]);
    }

    public function test_non_draft_document_cannot_be_deleted(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $document = $this->makeDocument('review');

        $response = $this->actingAs($controller)->deleteJson("/api/documents/{$document->id}");

        $response->assertStatus(422);
        $this->assertDatabaseHas('documents', ['id' => $document->id, 'deleted_at' => null]);
    }

    public function test_drafter_without_document_control_cannot_delete(): void
    {
        $this->activateLicense();
        $drafter = $this->makeUser('drafter');
        $document = $this->makeDocument('draft');

        $this->actingAs($drafter)->deleteJson("/api/documents/{$document->id}")->assertStatus(403);
    }

    // --- Lifecycle actions ---

    public function test_controller_can_freeze_released_document_with_reason(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $document = $this->makeDocument('released');

        $response = $this->actingAs($controller)->postJson("/api/documents/{$document->id}/lifecycle-action", [
            'action' => 'freeze',
            'reason' => 'Sedang ditinjau ulang oleh tim QA.',
        ]);

        $response->assertOk()->assertJsonPath('document.status', 'frozen');
        $this->assertSame('tidak_berlaku', $document->fresh()->validity);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'lifecycle_action',
            'entity_id' => (string) $document->id,
        ]);
    }

    public function test_sysadmin_can_perform_lifecycle_actions(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');
        $document = $this->makeDocument('released');

        $this->actingAs($sysadmin)->postJson("/api/documents/{$document->id}/lifecycle-action", [
            'action' => 'revoke',
            'reason' => 'Ditarik karena kesalahan substansi.',
        ])->assertOk()->assertJsonPath('document.status', 'revoked');
    }

    public function test_reviewer_cannot_perform_lifecycle_actions(): void
    {
        $this->activateLicense();
        $reviewer = $this->makeUser('reviewer');
        $document = $this->makeDocument('released');

        $this->actingAs($reviewer)->postJson("/api/documents/{$document->id}/lifecycle-action", [
            'action' => 'freeze',
            'reason' => 'Mencoba tanpa wewenang.',
        ])->assertStatus(403);
    }

    public function test_reason_shorter_than_ten_characters_is_rejected(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $document = $this->makeDocument('released');

        $this->actingAs($controller)->postJson("/api/documents/{$document->id}/lifecycle-action", [
            'action' => 'freeze',
            'reason' => 'pendek',
        ])->assertStatus(422);
    }

    public function test_action_not_applicable_to_current_status_is_rejected(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $document = $this->makeDocument('draft');

        // 'freeze' only applies to released documents.
        $this->actingAs($controller)->postJson("/api/documents/{$document->id}/lifecycle-action", [
            'action' => 'freeze',
            'reason' => 'Tidak seharusnya berhasil.',
        ])->assertStatus(422);
    }

    public function test_supersede_creates_reciprocal_document_relations(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $old = $this->makeDocument('released', ['code' => 'SOP-QA-001']);
        $new = $this->makeDocument('released', ['code' => 'SOP-QA-002']);

        $response = $this->actingAs($controller)->postJson("/api/documents/{$old->id}/lifecycle-action", [
            'action' => 'supersede',
            'reason' => 'Digantikan revisi terbaru sesuai keputusan rapat tinjauan.',
            'replacement_code' => $new->code,
        ]);

        $response->assertOk()->assertJsonPath('document.status', 'obsolete');

        $this->assertDatabaseHas('document_relations', [
            'document_id' => $old->id, 'type' => 'superseded_by', 'target_document_id' => $new->id,
        ]);
        $this->assertDatabaseHas('document_relations', [
            'document_id' => $new->id, 'type' => 'supersedes', 'target_document_id' => $old->id,
        ]);
    }

    public function test_supersede_requires_replacement_code(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $document = $this->makeDocument('released');

        $this->actingAs($controller)->postJson("/api/documents/{$document->id}/lifecycle-action", [
            'action' => 'supersede',
            'reason' => 'Lupa menyertakan kode pengganti.',
        ])->assertStatus(422);
    }

    public function test_unfreeze_returns_document_to_released(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $document = $this->makeDocument('frozen', ['validity' => 'tidak_berlaku']);

        $this->actingAs($controller)->postJson("/api/documents/{$document->id}/lifecycle-action", [
            'action' => 'unfreeze',
            'reason' => 'Tinjauan selesai, dokumen berlaku kembali.',
        ])->assertOk()->assertJsonPath('document.status', 'released');

        $this->assertSame('berlaku', $document->fresh()->validity);
    }

    public function test_cancel_only_applies_before_release(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $document = $this->makeDocument('approval');

        $this->actingAs($controller)->postJson("/api/documents/{$document->id}/lifecycle-action", [
            'action' => 'cancel',
            'reason' => 'Dibatalkan sebelum dirilis karena kebutuhan berubah.',
        ])->assertOk()->assertJsonPath('document.status', 'cancelled');

        $released = $this->makeDocument('released');
        $this->actingAs($controller)->postJson("/api/documents/{$released->id}/lifecycle-action", [
            'action' => 'cancel',
            'reason' => 'Seharusnya tidak berlaku untuk released.',
        ])->assertStatus(422);
    }
}
