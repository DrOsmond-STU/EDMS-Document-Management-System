<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\Standard;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Notifikasi lonceng yang menghubungkan modul: siapa yang harus bertindak berikutnya diberi tahu. */
class WorkflowNotificationTest extends TestCase
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
        OrgFunction::create(['id' => 'it', 'name' => 'IT', 'active' => true]);
        Standard::create(['code' => 'ISO9001', 'name' => 'ISO 9001', 'active' => true]);
    }

    private function user(string $email, array $roles, ?string $function = 'qa'): User
    {
        $u = User::create(['name' => $email, 'email' => $email, 'password' => 'rahasia-panjang-sekali', 'active' => true, 'must_change_password' => false, 'function_id' => $function]);
        foreach ($roles as $r) {
            Role::firstOrCreate(['id' => $r], ['label' => $r]);
            $u->roles()->attach($r);
        }

        return $u;
    }

    private function titles(User $u): array
    {
        return AppNotification::where('user_id', $u->id)->pluck('title')->all();
    }

    public function test_document_stages_notify_the_next_actor_and_respect_classification(): void
    {
        $drafter = $this->user('drafter@x.com', ['drafter']);
        $reviewer = $this->user('reviewer@x.com', ['reviewer']);
        $reviewerOtherFn = $this->user('reviewer-it@x.com', ['reviewer'], 'it');
        $approver = $this->user('approver@x.com', ['approver']);
        $owner = $this->user('owner@x.com', ['viewer']);

        $doc = Document::create(['code' => 'SOP-QA-001', 'title' => 'SOP Rahasia', 'type' => 'SOP', 'function_id' => 'qa', 'classification' => 'confidential',
            'status' => 'draft', 'validity' => 'belum_berlaku', 'version' => '1.0', 'revision_number' => 0, 'created_by' => $drafter->id, 'owner_id' => $owner->id]);
        DocumentFile::create(['document_id' => $doc->id, 'original_name' => 'a.pdf', 'disk' => 'local', 'stored_path' => 'a.pdf', 'mime_type' => 'application/pdf',
            'size_bytes' => 1, 'checksum_sha256' => str_repeat('a', 64), 'is_primary' => true, 'uploaded_by_name' => 'x']);

        $this->actingAs($drafter)->postJson("/api/documents/{$doc->id}/transition", ['to_status' => 'review'])->assertOk();
        $this->assertContains('Dokumen menunggu review Anda: SOP-QA-001', $this->titles($reviewer), 'Reviewer fungsi QA (izin Rahasia di fungsinya) harus diberi tahu.');
        $this->assertSame([], $this->titles($reviewerOtherFn), 'Reviewer fungsi lain tidak berhak melihat dokumen Rahasia — tidak boleh menerima judulnya.');
        $this->assertSame([], $this->titles($drafter), 'Pelaku tidak perlu diberi tahu tindakannya sendiri.');

        $this->actingAs($reviewer)->postJson("/api/documents/{$doc->id}/transition", ['to_status' => 'approval'])->assertOk();
        $this->assertContains('Dokumen menunggu persetujuan Anda: SOP-QA-001', $this->titles($approver));

        $this->actingAs($approver)->postJson("/api/documents/{$doc->id}/transition", ['to_status' => 'released'])->assertOk();
        $this->assertContains('Dokumen telah terbit: SOP-QA-001', $this->titles($owner));
        $this->assertContains('Dokumen telah terbit: SOP-QA-001', $this->titles($drafter));

        $this->actingAs($approver)->getJson('/api/notifications')->assertOk()->assertJsonPath('notifications.0.link', '/documents/'.$doc->id);
    }

    public function test_drafting_project_notifies_drafter_ratifier_and_requester(): void
    {
        $requester = $this->user('req@x.com', ['requester']);
        $controller = $this->user('ctrl@x.com', ['controller']);
        $drafter = $this->user('drafter@x.com', ['drafter']);
        $ratifier = $this->user('rat@x.com', ['ratifier']);

        $project = $this->actingAs($requester)->postJson('/api/drafting-projects', ['title' => 'SOP Baru', 'doc_type' => 'SOP', 'function_id' => 'qa',
            'classification' => 'internal', 'reason' => 'Perlu'])->assertCreated()->json();
        $this->actingAs($controller)->postJson("/api/drafting-projects/{$project['id']}/assign", ['drafter_id' => $drafter->id])->assertOk();
        $this->assertContains("Anda ditugaskan menyusun {$project['code']}", $this->titles($drafter));
        $this->assertContains("Permintaan {$project['code']} mulai disusun oleh {$drafter->name}", $this->titles($requester));

        $this->actingAs($controller)->postJson("/api/drafting-projects/{$project['id']}/reject", ['reason' => 'Duplikat dengan SOP lain'])->assertOk();
        $this->assertContains("Permintaan {$project['code']} ditolak", $this->titles($requester));
        $this->assertSame([], $this->titles($ratifier));
    }

    public function test_findings_and_audits_notify_the_head_of_the_responsible_function(): void
    {
        $auditor = $this->user('aud@x.com', ['auditor'], 'it');
        $headQa = $this->user('head-qa@x.com', ['function_head'], 'qa');
        $headIt = $this->user('head-it@x.com', ['function_head'], 'it');

        $this->actingAs($auditor)->postJson('/api/audits', ['type' => 'internal', 'title' => 'Audit QA', 'function_id' => 'qa',
            'planned_start' => now()->addDay()->toDateString(), 'planned_end' => now()->addDays(2)->toDateString()])->assertCreated();
        $this->actingAs($auditor)->postJson('/api/findings', ['type' => 'nc_minor', 'audit_source' => 'internal', 'title' => 'Dokumen kedaluwarsa', 'function_id' => 'qa'])->assertCreated();

        $titles = $this->titles($headQa);
        $this->assertCount(2, $titles);
        $this->assertStringStartsWith('Fungsi Anda dijadwalkan audit: AUD-INT-', $titles[0]);
        $this->assertStringStartsWith('Temuan baru untuk fungsi Anda: FIND-', $titles[1]);
        $this->assertSame([], $this->titles($headIt), 'Kepala fungsi lain tidak ikut diberi tahu.');
    }
}
