<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Document;
use App\Models\DocumentComment;
use App\Models\DocumentFile;
use App\Models\DraftingMeeting;
use App\Models\DraftingProject;
use App\Models\Finding;
use App\Models\FindingAction;
use App\Models\OrgFunction;
use App\Models\Risk;
use App\Models\RiskControl;
use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * IDOR (Insecure Direct Object Reference): pengguna yang SAH punya peran
 * tetap tidak boleh menyentuh data milik orang lain hanya dengan menebak ID,
 * dan ID anak tidak boleh "dipinjam" lewat induk lain (mis. meeting proyek A
 * lewat URL proyek B).
 */
class IdorProtectionTest extends TestCase
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
        OrgFunction::create(['id' => 'hse', 'name' => 'HSE', 'active' => true]);
    }

    private function user(string $email, array $roles): User
    {
        $user = User::create(['name' => $email, 'email' => $email, 'password' => 'rahasia-panjang-sekali', 'active' => true, 'must_change_password' => false]);
        foreach ($roles as $r) {
            Role::firstOrCreate(['id' => $r], ['label' => $r]);
            $user->roles()->attach($r);
        }

        return $user;
    }

    private function project(User $requester, string $status = 'requested'): DraftingProject
    {
        return DraftingProject::create(['code' => 'REQ-'.uniqid(), 'title' => 'Rahasia '.$requester->email, 'doc_type' => 'SOP', 'function_id' => 'hse',
            'classification' => 'internal', 'reason' => 'x', 'requester_id' => $requester->id, 'status' => $status]);
    }

    public function test_requester_cannot_see_or_change_another_requesters_project(): void
    {
        $alice = $this->user('alice@example.com', ['requester']);
        $bob = $this->user('bob@example.com', ['requester']);
        $project = $this->project($alice);

        $this->actingAs($bob)->getJson("/api/drafting-projects/{$project->id}")->assertForbidden();
        $this->actingAs($bob)->patchJson("/api/drafting-projects/{$project->id}", ['title' => 'Diretas'])->assertForbidden();
        $this->actingAs($bob)->deleteJson("/api/drafting-projects/{$project->id}")->assertForbidden();
        $list = $this->actingAs($bob)->getJson('/api/drafting-projects')->assertOk()->json('projects');
        $this->assertSame([], $list);
        $this->assertSame('Rahasia alice@example.com', $project->fresh()->title);
    }

    public function test_child_ids_cannot_be_borrowed_through_another_parent(): void
    {
        $controller = $this->user('ctrl@example.com', ['controller', 'drafter', 'compliance_admin']);
        $a = $this->project($controller, 'in_progress');
        $a->update(['drafter_id' => $controller->id]);
        $b = $this->project($controller, 'in_progress');
        $b->update(['drafter_id' => $controller->id]);
        $meetingOfB = DraftingMeeting::create(['drafting_project_id' => $b->id, 'session_no' => 1, 'agenda' => 'x', 'scheduled_at' => now()]);
        $this->actingAs($controller)->deleteJson("/api/drafting-projects/{$a->id}/meetings/{$meetingOfB->id}")->assertNotFound();

        $risk1 = Risk::create(['code' => 'RISK-0001', 'title' => 'R1', 'category' => 'safety', 'inherent_likelihood' => 1, 'inherent_impact' => 1, 'inherent_level' => 'low',
            'residual_likelihood' => 1, 'residual_impact' => 1, 'residual_level' => 'low', 'treatment' => 'accept', 'status' => 'identified']);
        $risk2 = $risk1->replicate()->fill(['code' => 'RISK-0002']);
        $risk2->save();
        $controlOf2 = RiskControl::create(['risk_id' => $risk2->id, 'description' => 'C']);
        $this->actingAs($controller)->deleteJson("/api/risks/{$risk1->id}/controls/{$controlOf2->id}")->assertNotFound();
        $this->assertNotNull($controlOf2->fresh());

        $f1 = Finding::create(['code' => 'FIND-0001', 'type' => 'ofi', 'audit_source' => 'internal', 'title' => 'F1', 'status' => 'open']);
        $f2 = Finding::create(['code' => 'FIND-0002', 'type' => 'ofi', 'audit_source' => 'internal', 'title' => 'F2', 'status' => 'open']);
        $actionOf2 = FindingAction::create(['finding_id' => $f2->id, 'type' => 'corrective', 'description' => 'x', 'pic' => 'y', 'status' => 'open']);
        $this->actingAs($controller)->patchJson("/api/findings/{$f1->id}/actions/{$actionOf2->id}", ['status' => 'completed'])->assertNotFound();
        $this->assertSame('open', $actionOf2->fresh()->status);

        $doc1 = Document::create(['code' => 'SOP-HSE-001', 'title' => 'D1', 'type' => 'SOP', 'function_id' => 'hse', 'classification' => 'internal',
            'status' => 'draft', 'validity' => 'belum_berlaku', 'version' => '0.1', 'revision_number' => 0]);
        $doc2 = $doc1->replicate()->fill(['code' => 'SOP-HSE-002']);
        $doc2->save();
        $fileOf2 = DocumentFile::create(['document_id' => $doc2->id, 'original_name' => 'a.pdf', 'disk' => 'local', 'stored_path' => 'documents/a.pdf',
            'mime_type' => 'application/pdf', 'size_bytes' => 10, 'checksum_sha256' => str_repeat('a', 64), 'is_primary' => true, 'uploaded_by_name' => 'x']);
        $this->actingAs($controller)->deleteJson("/api/documents/{$doc1->id}/files/{$fileOf2->id}")->assertNotFound();
        $this->assertNotNull($fileOf2->fresh());
    }

    public function test_comments_and_notifications_belong_to_their_owner(): void
    {
        $author = $this->user('author@example.com', ['drafter']);
        $other = $this->user('other@example.com', ['drafter']);
        $doc = Document::create(['code' => 'SOP-HSE-001', 'title' => 'D', 'type' => 'SOP', 'function_id' => 'hse', 'classification' => 'internal',
            'status' => 'draft', 'validity' => 'belum_berlaku', 'version' => '0.1', 'revision_number' => 0]);
        $comment = DocumentComment::create(['document_id' => $doc->id, 'user_id' => $author->id, 'body' => 'asli']);

        $this->actingAs($other)->patchJson("/api/comments/{$comment->id}", ['body' => 'diubah orang lain'])->assertForbidden();
        $this->actingAs($other)->deleteJson("/api/comments/{$comment->id}")->assertForbidden();
        $this->assertSame('asli', $comment->fresh()->body);

        $note = AppNotification::create(['user_id' => $author->id, 'type' => 'x', 'title' => 'Pribadi', 'body' => 'b']);
        $this->actingAs($other)->postJson("/api/notifications/{$note->id}/read")->assertNotFound();
        $this->assertNull($note->fresh()->read_at);
        $this->actingAs($other)->getJson('/api/notifications')->assertOk()->assertJsonMissing(['title' => 'Pribadi']);
    }

    public function test_mass_assignment_of_protected_fields_is_ignored(): void
    {
        $requester = $this->user('req@example.com', ['requester']);
        $res = $this->actingAs($requester)->postJson('/api/drafting-projects', [
            'title' => 'Prosedur X', 'doc_type' => 'SOP', 'function_id' => 'hse', 'classification' => 'internal', 'reason' => 'x',
            // Upaya menyusupkan field yang seharusnya dikendalikan server:
            'status' => 'ratified', 'requester_id' => 999, 'drafter_id' => $requester->id, 'code' => 'REQ-HACK', 'document_id' => 1,
        ])->assertCreated();
        $this->assertSame('requested', $res->json('status'));
        $this->assertSame($requester->id, $res->json('requester_id'));
        $this->assertNull($res->json('drafter_id'));
        $this->assertNotSame('REQ-HACK', $res->json('code'));

        $admin = $this->user('sys@example.com', ['sysadmin']);
        $this->actingAs($admin)->patchJson("/api/users/{$requester->id}", ['name' => 'Baru', 'password' => 'diganti-lewat-patch', 'must_change_password' => false])->assertOk();
        $login = $this->postJson('/api/auth/login', ['email' => 'req@example.com', 'password' => 'diganti-lewat-patch']);
        $this->assertContains($login->status(), [401, 422], 'Password tidak boleh bisa diganti lewat PATCH data pengguna.');
    }
}
