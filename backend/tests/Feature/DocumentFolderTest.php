<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentFolder;
use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentFolderTest extends TestCase
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

    private function makeDocument(string $code, string $status = 'released'): Document
    {
        OrgFunction::firstOrCreate(['id' => 'qa'], ['name' => 'Quality Assurance', 'active' => true]);

        return Document::create([
            'code' => $code, 'title' => "Dokumen {$code}", 'type' => 'SOP', 'function_id' => 'qa',
            'classification' => 'internal', 'status' => $status,
            'validity' => $status === 'released' ? 'berlaku' : 'belum_berlaku',
            'version' => '1.0', 'revision_number' => 0,
        ]);
    }

    public function test_only_document_control_can_create_folders(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');
        $controller = $this->makeUser('controller');

        $this->actingAs($viewer)->postJson('/api/folders', ['name' => 'K3'])->assertStatus(403);
        $this->actingAs($controller)->postJson('/api/folders', ['name' => 'K3'])->assertCreated();
        $this->actingAs($viewer)->getJson('/api/folders')->assertOk()->assertJsonPath('can_manage', false);
    }

    public function test_viewer_sees_only_released_documents_and_counts_in_folder(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $viewer = $this->makeUser('viewer');
        $released = $this->makeDocument('SOP-QA-001');
        $draft = $this->makeDocument('SOP-QA-002', 'draft');
        $folder = $this->actingAs($controller)->postJson('/api/folders', ['name' => 'Prosedur Mutu'])->json();
        $this->actingAs($controller)->postJson("/api/folders/{$folder['id']}/documents", ['document_ids' => [$released->id, $draft->id]])
            ->assertOk()->assertJsonPath('added', 2);

        $this->assertCount(2, $this->actingAs($controller)->getJson("/api/folders/{$folder['id']}/documents")->json('documents'));

        $docs = $this->actingAs($viewer)->getJson("/api/folders/{$folder['id']}/documents")->json('documents');
        $this->assertCount(1, $docs);
        $this->assertSame('SOP-QA-001', $docs[0]['code']);
        $count = collect($this->actingAs($viewer)->getJson('/api/folders')->json('folders'))->firstWhere('id', $folder['id'])['documents_count'];
        $this->assertSame(1, $count);
    }

    public function test_document_can_live_in_many_folders_and_deleting_folder_keeps_document(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $doc = $this->makeDocument('SOP-QA-001');
        $a = $this->actingAs($controller)->postJson('/api/folders', ['name' => 'Audit 2026'])->json();
        $b = $this->actingAs($controller)->postJson('/api/folders', ['name' => 'Onboarding'])->json();
        $this->actingAs($controller)->postJson("/api/folders/{$a['id']}/documents", ['document_ids' => [$doc->id]]);
        $this->actingAs($controller)->postJson("/api/folders/{$b['id']}/documents", ['document_ids' => [$doc->id]]);
        $this->actingAs($controller)->postJson("/api/folders/{$b['id']}/documents", ['document_ids' => [$doc->id]]); // idempoten

        $this->assertDatabaseCount('document_folder_items', 2);

        $this->actingAs($controller)->deleteJson("/api/folders/{$a['id']}")->assertOk();
        $this->assertDatabaseHas('documents', ['id' => $doc->id, 'deleted_at' => null]);
        $this->assertDatabaseCount('document_folder_items', 1);
    }

    public function test_folder_with_subfolders_cannot_be_deleted(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $parent = $this->actingAs($controller)->postJson('/api/folders', ['name' => 'K3'])->json();
        $this->actingAs($controller)->postJson('/api/folders', ['name' => 'APD', 'parent_id' => $parent['id']])->assertCreated();

        $this->actingAs($controller)->deleteJson("/api/folders/{$parent['id']}")->assertStatus(422);
    }

    public function test_folder_cannot_be_moved_into_its_own_descendant(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $a = $this->actingAs($controller)->postJson('/api/folders', ['name' => 'A'])->json();
        $b = $this->actingAs($controller)->postJson('/api/folders', ['name' => 'B', 'parent_id' => $a['id']])->json();
        $c = $this->actingAs($controller)->postJson('/api/folders', ['name' => 'C', 'parent_id' => $b['id']])->json();

        $this->actingAs($controller)->patchJson("/api/folders/{$a['id']}", ['parent_id' => $c['id']])->assertStatus(422);
        $this->actingAs($controller)->patchJson("/api/folders/{$a['id']}", ['parent_id' => $a['id']])->assertStatus(422);
        $this->actingAs($controller)->patchJson("/api/folders/{$c['id']}", ['parent_id' => null])->assertOk();
    }

    public function test_duplicate_name_in_same_parent_is_rejected_but_allowed_elsewhere(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $a = $this->actingAs($controller)->postJson('/api/folders', ['name' => 'Arsip'])->json();

        $this->actingAs($controller)->postJson('/api/folders', ['name' => 'Arsip'])->assertStatus(422);
        $this->actingAs($controller)->postJson('/api/folders', ['name' => 'Arsip', 'parent_id' => $a['id']])->assertCreated();
    }

    public function test_categories_can_be_assigned_and_listed_with_visibility(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $viewer = $this->makeUser('viewer');
        $released = $this->makeDocument('SOP-QA-001');
        $draft = $this->makeDocument('SOP-QA-002', 'draft');
        $cat = $this->actingAs($controller)->postJson('/api/document-categories', ['name' => 'Wajib Dibaca', 'color' => '#b23b3a'])->assertCreated()->json();

        $this->actingAs($controller)->putJson("/api/documents/{$released->id}/categories", ['category_ids' => [$cat['id']]])->assertOk();
        $this->actingAs($controller)->putJson("/api/documents/{$draft->id}/categories", ['category_ids' => [$cat['id']]])->assertOk();
        $this->actingAs($viewer)->putJson("/api/documents/{$released->id}/categories", ['category_ids' => []])->assertStatus(403);

        $this->assertCount(1, $this->actingAs($viewer)->getJson("/api/document-categories/{$cat['id']}/documents")->json('documents'));
        $this->assertCount(2, $this->actingAs($controller)->getJson("/api/document-categories/{$cat['id']}/documents")->json('documents'));

        $this->actingAs($controller)->deleteJson("/api/document-categories/{$cat['id']}")->assertOk();
        $this->assertSame(2, Document::count());
    }

    public function test_invalid_category_color_is_rejected(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');

        $this->actingAs($controller)->postJson('/api/document-categories', ['name' => 'X', 'color' => 'red'])->assertStatus(422);
    }

    public function test_search_within_folder(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $a = $this->makeDocument('SOP-QA-001');
        $b = $this->makeDocument('WI-QA-007');
        $folder = DocumentFolder::create(['name' => 'Semua']);
        $folder->documents()->attach([$a->id, $b->id]);

        $docs = $this->actingAs($controller)->getJson("/api/folders/{$folder->id}/documents?q=WI-QA")->json('documents');
        $this->assertCount(1, $docs);
        $this->assertSame('WI-QA-007', $docs[0]['code']);
    }
}
