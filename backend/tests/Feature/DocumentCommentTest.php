<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Document;
use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentCommentTest extends TestCase
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

    private function makeUser(string $roleId, ?string $email = null): User
    {
        Role::firstOrCreate(['id' => $roleId], ['label' => ucfirst($roleId)]);
        $user = User::create([
            'name' => 'Pengguna '.($email ?? $roleId),
            'email' => $email ?? $roleId.'@example.com',
            'password' => 'rahasia-panjang-sekali',
            'active' => true,
            'must_change_password' => false,
        ]);
        $user->roles()->attach($roleId);

        return $user;
    }

    private function doc(string $status = 'released', ?int $ownerId = null): Document
    {
        OrgFunction::firstOrCreate(['id' => 'qa'], ['name' => 'QA', 'active' => true]);

        return Document::create([
            'code' => 'SOP-QA-'.random_int(100, 999), 'title' => 'Prosedur Uji', 'type' => 'SOP', 'function_id' => 'qa',
            'classification' => 'internal', 'status' => $status, 'validity' => $status === 'released' ? 'berlaku' : 'belum_berlaku',
            'version' => '1.0', 'revision_number' => 0, 'owner_id' => $ownerId,
        ]);
    }

    public function test_viewer_can_discuss_released_document_but_not_draft(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');
        $released = $this->doc();
        $draft = $this->doc('draft');

        $this->actingAs($viewer)->postJson("/api/documents/{$released->id}/comments", ['body' => 'Apakah lampiran B masih berlaku?', 'section' => 'Lampiran B'])
            ->assertCreated()->assertJsonPath('section', 'Lampiran B');
        $this->actingAs($viewer)->getJson("/api/documents/{$draft->id}/comments")->assertStatus(403);
        $this->actingAs($viewer)->postJson("/api/documents/{$draft->id}/comments", ['body' => 'x'])->assertStatus(403);
    }

    public function test_replies_are_nested_and_reply_reopens_resolved_thread(): void
    {
        $this->activateLicense();
        $reviewer = $this->makeUser('reviewer');
        $drafter = $this->makeUser('drafter');
        $doc = $this->doc('review', $drafter->id);
        $thread = $this->actingAs($reviewer)->postJson("/api/documents/{$doc->id}/comments", ['body' => 'Definisi di Bab 3 kurang jelas.'])->json();

        $this->actingAs($drafter)->postJson("/api/comments/{$thread['id']}/resolve", ['resolved' => true])->assertOk(); // pemilik dokumen
        $this->actingAs($drafter)->postJson("/api/documents/{$doc->id}/comments", ['body' => 'Sudah diperbaiki.', 'parent_id' => $thread['id']])->assertCreated();

        $threads = $this->actingAs($reviewer)->getJson("/api/documents/{$doc->id}/comments")->json('threads');
        $this->assertCount(1, $threads);
        $this->assertCount(1, $threads[0]['replies']);
        $this->assertNull($threads[0]['resolved_at']); // dibuka kembali oleh balasan
    }

    public function test_cannot_reply_to_a_reply_or_to_another_documents_thread(): void
    {
        $this->activateLicense();
        $reviewer = $this->makeUser('reviewer');
        $a = $this->doc('review');
        $b = $this->doc('review');
        $thread = $this->actingAs($reviewer)->postJson("/api/documents/{$a->id}/comments", ['body' => 'x'])->json();
        $reply = $this->actingAs($reviewer)->postJson("/api/documents/{$a->id}/comments", ['body' => 'y', 'parent_id' => $thread['id']])->json();

        $this->actingAs($reviewer)->postJson("/api/documents/{$a->id}/comments", ['body' => 'z', 'parent_id' => $reply['id']])->assertStatus(422);
        $this->actingAs($reviewer)->postJson("/api/documents/{$b->id}/comments", ['body' => 'z', 'parent_id' => $thread['id']])->assertStatus(422);
    }

    public function test_mention_notifies_only_users_who_can_view_the_document(): void
    {
        $this->activateLicense();
        $reviewer = $this->makeUser('reviewer');
        $drafter = $this->makeUser('drafter');
        $viewer = $this->makeUser('viewer'); // tidak boleh melihat draft
        $draft = $this->doc('draft');

        $this->actingAs($reviewer)->postJson("/api/documents/{$draft->id}/comments", [
            'body' => '@drafter @viewer mohon cek', 'mentions' => [$drafter->id, $viewer->id],
        ])->assertCreated();

        $this->assertDatabaseHas('app_notifications', ['user_id' => $drafter->id, 'type' => 'comment_mention']);
        $this->assertDatabaseMissing('app_notifications', ['user_id' => $viewer->id]);
    }

    public function test_owner_and_parent_author_are_notified_but_never_the_author_self(): void
    {
        $this->activateLicense();
        $owner = $this->makeUser('drafter');
        $reviewer = $this->makeUser('reviewer');
        $doc = $this->doc('review', $owner->id);

        $thread = $this->actingAs($reviewer)->postJson("/api/documents/{$doc->id}/comments", ['body' => 'Catatan 1', 'mentions' => [$reviewer->id]])->json();
        $this->assertSame(1, AppNotification::where('user_id', $owner->id)->where('type', 'comment_on_document')->count());
        $this->assertSame(0, AppNotification::where('user_id', $reviewer->id)->count());

        $this->actingAs($owner)->postJson("/api/documents/{$doc->id}/comments", ['body' => 'Siap', 'parent_id' => $thread['id']]);
        $this->assertSame(1, AppNotification::where('user_id', $reviewer->id)->where('type', 'comment_reply')->count());
    }

    public function test_only_author_edits_and_author_or_controller_deletes_with_body_hidden(): void
    {
        $this->activateLicense();
        $reviewer = $this->makeUser('reviewer');
        $approver = $this->makeUser('approver');
        $controller = $this->makeUser('controller');
        $doc = $this->doc('review');
        $thread = $this->actingAs($reviewer)->postJson("/api/documents/{$doc->id}/comments", ['body' => 'Asli'])->json();
        $this->actingAs($approver)->postJson("/api/documents/{$doc->id}/comments", ['body' => 'Balasan', 'parent_id' => $thread['id']]);

        $this->actingAs($approver)->patchJson("/api/comments/{$thread['id']}", ['body' => 'Diubah'])->assertStatus(403);
        $this->actingAs($reviewer)->patchJson("/api/comments/{$thread['id']}", ['body' => 'Diubah'])->assertOk()->assertJsonPath('body', 'Diubah');
        $this->actingAs($approver)->deleteJson("/api/comments/{$thread['id']}")->assertStatus(403);
        $this->actingAs($controller)->deleteJson("/api/comments/{$thread['id']}")->assertOk();

        $threads = $this->actingAs($reviewer)->getJson("/api/documents/{$doc->id}/comments")->json('threads');
        $this->assertCount(1, $threads); // utas tetap tampil karena ada balasan
        $this->assertTrue($threads[0]['is_deleted']);
        $this->assertNull($threads[0]['body']);
        $this->assertSame('Balasan', $threads[0]['replies'][0]['body']);
    }

    public function test_resolve_permission(): void
    {
        $this->activateLicense();
        $reviewer = $this->makeUser('reviewer');
        $approver = $this->makeUser('approver');
        $doc = $this->doc('review');
        $thread = $this->actingAs($reviewer)->postJson("/api/documents/{$doc->id}/comments", ['body' => 'x'])->json();

        $this->actingAs($approver)->postJson("/api/comments/{$thread['id']}/resolve", ['resolved' => true])->assertStatus(403);
        $this->actingAs($reviewer)->postJson("/api/comments/{$thread['id']}/resolve", ['resolved' => true])->assertOk();
    }

    public function test_inbox_filters_and_hides_invisible_documents(): void
    {
        $this->activateLicense();
        $reviewer = $this->makeUser('reviewer');
        $viewer = $this->makeUser('viewer');
        $released = $this->doc();
        $draft = $this->doc('draft');
        $this->actingAs($reviewer)->postJson("/api/documents/{$released->id}/comments", ['body' => 'Terbuka', 'mentions' => [$viewer->id]]);
        $this->actingAs($reviewer)->postJson("/api/documents/{$draft->id}/comments", ['body' => 'Rahasia draft']);

        $this->assertCount(2, $this->actingAs($reviewer)->getJson('/api/discussions')->json('threads'));
        $viewerInbox = $this->actingAs($viewer)->getJson('/api/discussions')->json('threads');
        $this->assertCount(1, $viewerInbox);
        $this->assertSame('Terbuka', $viewerInbox[0]['body']);
        $this->assertCount(1, $this->actingAs($viewer)->getJson('/api/discussions?filter=mentions')->json('threads'));
    }

    public function test_notification_center_lists_and_marks_read_only_own(): void
    {
        $this->activateLicense();
        $a = $this->makeUser('viewer', 'a@example.com');
        $b = $this->makeUser('viewer', 'b@example.com');
        $mine = AppNotification::create(['user_id' => $a->id, 'type' => 'x', 'title' => 'Untuk A']);
        $theirs = AppNotification::create(['user_id' => $b->id, 'type' => 'x', 'title' => 'Untuk B']);

        $this->actingAs($a)->getJson('/api/notifications')->assertOk()->assertJsonPath('unread', 1)->assertJsonCount(1, 'notifications');
        $this->actingAs($a)->postJson("/api/notifications/{$theirs->id}/read")->assertNotFound();
        $this->actingAs($a)->postJson("/api/notifications/{$mine->id}/read")->assertOk();
        $this->actingAs($a)->getJson('/api/notifications')->assertJsonPath('unread', 0);
        $this->assertNull($theirs->fresh()->read_at);
    }
}
