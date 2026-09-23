<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\Standard;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DraftingProjectTest extends TestCase
{
    use RefreshDatabase;

    private const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('documents');
    }

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

    private function request(User $user): array
    {
        OrgFunction::firstOrCreate(['id' => 'hse'], ['name' => 'Health, Safety & Environment', 'active' => true]);
        Standard::firstOrCreate(['code' => 'ISO45001'], ['name' => 'ISO 45001', 'active' => true]);

        return $this->actingAs($user)->postJson('/api/drafting-projects', [
            'title' => 'Prosedur Izin Kerja Panas (Hot Work Permit)',
            'doc_type' => 'SOP',
            'function_id' => 'hse',
            'classification' => 'internal',
            'reason' => 'Temuan audit K3: pekerjaan pengelasan belum memiliki prosedur izin kerja.',
            'standards' => ['ISO45001'],
        ])->assertCreated()->json();
    }

    /** Rapat 1 dilaksanakan lengkap: notulen + 1 peserta bertanda tangan. */
    private function completeMeeting(User $drafter, int $projectId): array
    {
        $meeting = $this->actingAs($drafter)->postJson("/api/drafting-projects/{$projectId}/meetings", [
            'agenda' => 'Pembahasan draf awal', 'scheduled_at' => now()->addDay()->format('Y-m-d H:i'), 'location' => 'R. Rapat Lt.2',
        ])->assertCreated()->json();
        $this->actingAs($drafter)->patchJson("/api/drafting-projects/{$projectId}/meetings/{$meeting['id']}", [
            'held' => true, 'budget' => 750000, 'minutes' => 'Disepakati alur izin 3 tingkat.',
        ])->assertOk();
        $this->actingAs($drafter)->postJson("/api/drafting-projects/{$projectId}/meetings/{$meeting['id']}/attendees", [
            'name' => 'Budi Santoso', 'position' => 'Supervisor HSE', 'signature' => self::SIG,
        ])->assertCreated();

        return $meeting;
    }

    public function test_requester_gets_yearly_request_number_and_sees_only_own_requests(): void
    {
        $this->activateLicense();
        $requester = $this->makeUser('requester');
        $controller = $this->makeUser('controller');
        $mine = $this->request($requester);
        $this->request($controller);

        $this->assertSame('REQ-'.now()->format('Y').'-001', $mine['code']);
        $this->assertSame('requested', $mine['status']);
        $this->assertSame([true, false, false, false, false, false, false, false], $mine['stages']);

        $this->assertCount(1, $this->actingAs($requester)->getJson('/api/drafting-projects')->json('projects'));
        $this->assertCount(2, $this->actingAs($controller)->getJson('/api/drafting-projects')->json('projects'));
    }

    public function test_viewer_cannot_request_or_list(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');

        $this->actingAs($viewer)->getJson('/api/drafting-projects')->assertStatus(403);
        $this->actingAs($viewer)->postJson('/api/drafting-projects', ['title' => 'X'])->assertStatus(403);
    }

    public function test_drafter_takes_request_but_cannot_take_one_already_assigned(): void
    {
        $this->activateLicense();
        $requester = $this->makeUser('requester');
        $drafter = $this->makeUser('drafter');
        $project = $this->request($requester);

        $this->actingAs($drafter)->postJson("/api/drafting-projects/{$project['id']}/assign")
            ->assertOk()->assertJsonPath('status', 'in_progress')->assertJsonPath('drafter_id', $drafter->id);

        Role::firstOrCreate(['id' => 'drafter']);
        $other = User::create(['name' => 'Drafter 2', 'email' => 'd2@example.com', 'password' => 'rahasia-panjang-sekali', 'active' => true, 'must_change_password' => false]);
        $other->roles()->attach('drafter');
        $this->actingAs($other)->postJson("/api/drafting-projects/{$project['id']}/assign")->assertStatus(422);
    }

    public function test_only_assigned_drafter_or_controller_can_work_on_meetings(): void
    {
        $this->activateLicense();
        $requester = $this->makeUser('requester');
        $drafter = $this->makeUser('drafter');
        $reviewer = $this->makeUser('reviewer');
        $project = $this->request($requester);

        // belum ditugaskan → belum bisa rapat
        $this->actingAs($drafter)->postJson("/api/drafting-projects/{$project['id']}/meetings", ['agenda' => 'X', 'scheduled_at' => now()->toDateTimeString()])
            ->assertStatus(403);

        $this->actingAs($drafter)->postJson("/api/drafting-projects/{$project['id']}/assign");
        $this->actingAs($reviewer)->postJson("/api/drafting-projects/{$project['id']}/meetings", ['agenda' => 'X', 'scheduled_at' => now()->toDateTimeString()])
            ->assertStatus(403);
        $m1 = $this->actingAs($drafter)->postJson("/api/drafting-projects/{$project['id']}/meetings", ['agenda' => 'Rapat 1', 'scheduled_at' => now()->toDateTimeString()])->assertCreated()->json();
        $m2 = $this->actingAs($drafter)->postJson("/api/drafting-projects/{$project['id']}/meetings", ['agenda' => 'Rapat 2', 'scheduled_at' => now()->toDateTimeString()])->assertCreated()->json();
        $this->assertSame([1, 2], [$m1['session_no'], $m2['session_no']]);
    }

    public function test_finalize_blocked_until_meeting_evidence_complete_and_requires_pdf(): void
    {
        $this->activateLicense();
        $requester = $this->makeUser('requester');
        $drafter = $this->makeUser('drafter');
        $project = $this->request($requester);
        $this->actingAs($drafter)->postJson("/api/drafting-projects/{$project['id']}/assign");
        $meeting = $this->actingAs($drafter)->postJson("/api/drafting-projects/{$project['id']}/meetings", [
            'agenda' => 'Rapat 1', 'scheduled_at' => now()->toDateTimeString(),
        ])->json();
        $this->actingAs($drafter)->patchJson("/api/drafting-projects/{$project['id']}/meetings/{$meeting['id']}", ['held' => true]);
        $pdf = UploadedFile::fake()->create('final.pdf', 40, 'application/pdf');

        $gaps = $this->actingAs($drafter)->post("/api/drafting-projects/{$project['id']}/finalize", ['file' => $pdf], ['Accept' => 'application/json'])
            ->assertStatus(422)->json('gaps');
        $this->assertCount(2, $gaps); // notulen & daftar hadir bertanda tangan belum ada

        $this->actingAs($drafter)->patchJson("/api/drafting-projects/{$project['id']}/meetings/{$meeting['id']}", ['minutes' => 'Notulen.']);
        $attendee = $this->actingAs($drafter)->postJson("/api/drafting-projects/{$project['id']}/meetings/{$meeting['id']}/attendees", ['name' => 'Ani'])->json();
        $this->assertNull($attendee['signed_at']);
        $this->actingAs($drafter)->patchJson("/api/drafting-projects/{$project['id']}/meetings/{$meeting['id']}/attendees/{$attendee['id']}", ['signature' => self::SIG])->assertOk();

        $docx = UploadedFile::fake()->create('final.docx', 40, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        $this->actingAs($drafter)->post("/api/drafting-projects/{$project['id']}/finalize", ['file' => $docx], ['Accept' => 'application/json'])->assertStatus(422);

        $this->actingAs($drafter)->post("/api/drafting-projects/{$project['id']}/finalize", ['file' => $pdf, 'final_content' => 'Isi final.'], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('status', 'finalized');
    }

    public function test_full_flow_ratify_publishes_released_document_with_pdf_primary_file(): void
    {
        $this->activateLicense();
        $requester = $this->makeUser('requester');
        $drafter = $this->makeUser('drafter');
        $ratifier = $this->makeUser('ratifier');
        $project = $this->request($requester);
        $this->actingAs($drafter)->postJson("/api/drafting-projects/{$project['id']}/assign");
        $this->completeMeeting($drafter, $project['id']);
        $this->actingAs($drafter)->post("/api/drafting-projects/{$project['id']}/finalize", [
            'file' => UploadedFile::fake()->create('SOP Hot Work.pdf', 60, 'application/pdf'), 'final_content' => 'Ruang lingkup: ...',
        ], ['Accept' => 'application/json'])->assertOk();

        $this->actingAs($drafter)->postJson("/api/drafting-projects/{$project['id']}/ratify")->assertStatus(403); // drafter bukan pengesah

        $response = $this->actingAs($ratifier)->postJson("/api/drafting-projects/{$project['id']}/ratify")->assertOk();

        $this->assertSame([true, true, true, true, true, true, true, true], $response->json('project.stages'));
        $doc = Document::findOrFail($response->json('document.id'));
        $this->assertSame('SOP-HSE-001', $doc->code);
        $this->assertSame('released', $doc->status);
        $this->assertSame('berlaku', $doc->validity);
        $this->assertSame(0, $doc->revision_number);
        $this->assertSame($drafter->id, $doc->owner_id);
        $this->assertNotNull($doc->review_date);
        $this->assertSame(['ISO45001'], $doc->standards()->pluck('code')->all());

        $file = DocumentFile::where('document_id', $doc->id)->firstOrFail();
        $this->assertTrue($file->is_primary);
        $this->assertSame('application/pdf', $file->mime_type);
        Storage::disk('documents')->assertExists($file->stored_path);
        $this->assertSame(hash('sha256', Storage::disk('documents')->get($file->stored_path)), $file->checksum_sha256);

        $this->actingAs($ratifier)->postJson("/api/drafting-projects/{$project['id']}/ratify")->assertStatus(422); // tidak bisa disahkan dua kali
    }

    public function test_ratifier_can_return_finalized_project_with_note(): void
    {
        $this->activateLicense();
        $requester = $this->makeUser('requester');
        $drafter = $this->makeUser('drafter');
        $ratifier = $this->makeUser('ratifier');
        $project = $this->request($requester);
        $this->actingAs($drafter)->postJson("/api/drafting-projects/{$project['id']}/assign");
        $this->completeMeeting($drafter, $project['id']);
        $this->actingAs($drafter)->post("/api/drafting-projects/{$project['id']}/finalize", [
            'file' => UploadedFile::fake()->create('f.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json']);

        $this->actingAs($ratifier)->postJson("/api/drafting-projects/{$project['id']}/return", ['note' => ''])->assertStatus(422);
        $this->actingAs($ratifier)->postJson("/api/drafting-projects/{$project['id']}/return", ['note' => 'Lengkapi lampiran formulir izin.'])
            ->assertOk()->assertJsonPath('status', 'in_progress')->assertJsonPath('return_note', 'Lengkapi lampiran formulir izin.');

        // PDF final lama tetap tersimpan — finalisasi ulang tidak wajib unggah ulang
        $this->actingAs($drafter)->post("/api/drafting-projects/{$project['id']}/finalize", [], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('status', 'finalized');
    }

    public function test_controller_rejects_request_with_reason(): void
    {
        $this->activateLicense();
        $requester = $this->makeUser('requester');
        $controller = $this->makeUser('controller');
        $project = $this->request($requester);

        $this->actingAs($requester)->postJson("/api/drafting-projects/{$project['id']}/reject", ['reason' => 'x'])->assertStatus(403);
        $this->actingAs($controller)->postJson("/api/drafting-projects/{$project['id']}/reject", ['reason' => 'Sudah tercakup SOP-HSE-004.'])
            ->assertOk()->assertJsonPath('status', 'rejected');
    }

    public function test_invalid_signature_payload_is_rejected_and_signature_served_as_png(): void
    {
        $this->activateLicense();
        $requester = $this->makeUser('requester');
        $drafter = $this->makeUser('drafter');
        $project = $this->request($requester);
        $this->actingAs($drafter)->postJson("/api/drafting-projects/{$project['id']}/assign");
        $meeting = $this->actingAs($drafter)->postJson("/api/drafting-projects/{$project['id']}/meetings", ['agenda' => 'R1', 'scheduled_at' => now()->toDateTimeString()])->json();

        $this->actingAs($drafter)->postJson("/api/drafting-projects/{$project['id']}/meetings/{$meeting['id']}/attendees", [
            'name' => 'X', 'signature' => 'data:text/html;base64,PHNjcmlwdD4=',
        ])->assertStatus(422);

        $attendee = $this->actingAs($drafter)->postJson("/api/drafting-projects/{$project['id']}/meetings/{$meeting['id']}/attendees", [
            'name' => 'Ani', 'signature' => self::SIG,
        ])->assertCreated()->json();
        $this->assertArrayNotHasKey('signature', $attendee);

        $this->actingAs($drafter)->get("/api/drafting-projects/{$project['id']}/meetings/{$meeting['id']}/attendees/{$attendee['id']}/signature")
            ->assertOk()->assertHeader('Content-Type', 'image/png');
    }

    public function test_meeting_of_another_project_returns_404(): void
    {
        $this->activateLicense();
        $requester = $this->makeUser('requester');
        $drafter = $this->makeUser('drafter');
        $a = $this->request($requester);
        $b = $this->request($requester);
        $this->actingAs($drafter)->postJson("/api/drafting-projects/{$a['id']}/assign");
        $this->actingAs($drafter)->postJson("/api/drafting-projects/{$b['id']}/assign");
        $meeting = $this->actingAs($drafter)->postJson("/api/drafting-projects/{$a['id']}/meetings", ['agenda' => 'R1', 'scheduled_at' => now()->toDateTimeString()])->json();

        $this->actingAs($drafter)->patchJson("/api/drafting-projects/{$b['id']}/meetings/{$meeting['id']}", ['held' => true])->assertNotFound();
    }
}
