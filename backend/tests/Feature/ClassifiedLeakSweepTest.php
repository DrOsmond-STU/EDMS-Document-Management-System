<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentComment;
use App\Models\DocumentFile;
use App\Models\DraftingProject;
use App\Models\OrgFunction;
use App\Models\Record;
use App\Models\RecordSeries;
use App\Models\Role;
use App\Models\Standard;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Tests\TestCase;

/**
 * Penyapu kebocoran klasifikasi: data berlabel Secret (dokumen, rekaman,
 * proyek penyusunan — beserta berkas, komentar, dan jejak auditnya) tidak
 * boleh muncul di respons GET MANA PUN untuk pengguna yang izinnya hanya
 * sampai Confidential, walau ia memegang hampir semua peran modul.
 * Endpoint baru yang lupa menyaring klasifikasi otomatis tertangkap di sini.
 */
class ClassifiedLeakSweepTest extends TestCase
{
    use RefreshDatabase;

    private const MARKER = 'ZETA-RAHASIA-7731';

    private array $ids = [];

    protected function setUp(): void
    {
        parent::setUp();
        $service = app(LicenseService::class);
        $expires = now()->addYear()->toDateString();
        $this->postJson('/api/license/apply', [
            'license_key' => 'EDMS-TEST-0001', 'expires_at' => $expires, 'status' => 'active', 'company_name' => 'PT Uji',
            'signature' => $service->computeSignature('EDMS-TEST-0001', $expires, 'active', 'PT Uji', ''),
        ])->assertOk();
        OrgFunction::create(['id' => 'fin', 'name' => 'Finance', 'active' => true]);
        OrgFunction::create(['id' => 'hse', 'name' => 'HSE', 'active' => true]);
        Standard::create(['code' => 'ISO9001', 'name' => 'ISO 9001', 'active' => true]);

        $owner = $this->user('owner@example.com', ['ratifier', 'controller'], 'fin');
        $audit = app(AuditLogger::class);

        $doc = Document::create(['code' => 'SOP-FIN-009', 'title' => 'Dokumen '.self::MARKER, 'type' => 'SOP', 'function_id' => 'fin',
            'classification' => 'secret', 'status' => 'released', 'validity' => 'berlaku', 'version' => '1.0', 'revision_number' => 0,
            'content' => 'Isi '.self::MARKER, 'keywords' => [self::MARKER], 'owner_id' => $owner->id, 'created_by' => $owner->id]);
        $doc->standards()->sync(['ISO9001']);
        $file = DocumentFile::create(['document_id' => $doc->id, 'original_name' => self::MARKER.'.pdf', 'disk' => 'local', 'stored_path' => 'x.pdf',
            'mime_type' => 'application/pdf', 'size_bytes' => 1, 'checksum_sha256' => str_repeat('a', 64), 'is_primary' => true, 'uploaded_by_name' => 'x']);
        $comment = DocumentComment::create(['document_id' => $doc->id, 'user_id' => $owner->id, 'body' => 'Komentar '.self::MARKER]);
        $audit->log($owner, 'create', 'Document', (string) $doc->id, $doc->code.' '.self::MARKER, 'Membuat '.self::MARKER);
        $audit->log($owner, 'view', 'Document', (string) $doc->id, $doc->code, 'Melihat '.self::MARKER);
        $audit->log($owner, 'create', 'DocumentFile', (string) $file->id, self::MARKER, 'Unggah '.self::MARKER);
        $audit->log($owner, 'create', 'DocumentComment', (string) $comment->id, self::MARKER, 'Komentar '.self::MARKER);

        $series = RecordSeries::create(['code' => 'REK', 'name' => 'Rek', 'retention_active_years' => 1, 'retention_inactive_years' => 1, 'disposition' => 'destroy', 'active' => true]);
        $record = Record::create(['code' => 'REC-00009', 'series_id' => $series->id, 'title' => 'Rekaman '.self::MARKER, 'description' => self::MARKER,
            'record_date' => now()->subYears(3), 'medium' => 'physical', 'location' => 'Brankas '.self::MARKER, 'classification' => 'secret', 'function_id' => 'fin',
            'status' => 'active', 'active_until' => now()->subYear(), 'inactive_until' => now()->subDay(), 'legal_hold' => false, 'created_by' => $owner->id]);
        $audit->log($owner, 'create', 'Record', $record->code, $record->title, 'Mendaftarkan '.self::MARKER);

        $project = DraftingProject::create(['code' => 'REQ-2026-009', 'title' => 'Proyek '.self::MARKER, 'doc_type' => 'SOP', 'function_id' => 'fin',
            'classification' => 'secret', 'reason' => 'Alasan '.self::MARKER, 'requester_id' => $owner->id, 'status' => 'in_progress', 'drafter_id' => $owner->id]);
        $audit->log($owner, 'create', 'DraftingProject', $project->code, $project->title, 'Mengajukan '.self::MARKER);

        $this->ids = ['document' => $doc->id, 'file' => $file->id, 'comment' => $comment->id, 'record' => $record->id, 'project' => $project->id,
            'recordSeries' => $series->id, 'standard' => 'ISO9001', 'orgFunction' => 'fin'];
    }

    private function user(string $email, array $roles, ?string $function = 'hse'): User
    {
        $user = User::create(['name' => $email, 'email' => $email, 'password' => 'rahasia-panjang-sekali', 'active' => true,
            'must_change_password' => false, 'function_id' => $function]);
        foreach ($roles as $r) {
            Role::firstOrCreate(['id' => $r], ['label' => $r]);
            $user->roles()->attach($r);
        }

        return $user;
    }

    public function test_secret_data_never_appears_for_a_user_cleared_only_up_to_confidential(): void
    {
        // Hampir semua peran modul, tetapi izin klasifikasi tertinggi hanya Confidential.
        $reader = $this->user('pembaca@example.com', ['viewer', 'requester', 'drafter', 'reviewer', 'approver', 'function_head', 'compliance_admin', 'sysadmin']);

        $leaks = [];
        foreach (Route::getRoutes() as $route) {
            /** @var LaravelRoute $route */
            if (! str_starts_with($route->uri(), 'api/') || ! in_array('GET', $route->methods(), true)) {
                continue;
            }
            $url = '/'.preg_replace_callback('/\{(\w+)\}/', fn ($m) => (string) ($this->ids[$m[1]] ?? 999999), $route->uri());
            foreach (['', '?q='.self::MARKER, '?q=ZETA'] as $query) {
                $response = $this->actingAs($reader)->get($url.$query, ['Accept' => 'application/json']);
                $status = $response->baseResponse->getStatusCode();
                $this->assertLessThan(500, $status, "{$url}{$query} error {$status}");
                $body = $response->baseResponse instanceof StreamedResponse ? $response->streamedContent() : (string) $response->getContent();
                // Pencarian memantulkan kata kunci yang diketik pengguna sendiri — itu bukan kebocoran.
                $body = str_replace('"query":"'.self::MARKER.'"', '', $body);
                if (str_contains($body, self::MARKER)) {
                    $leaks[] = "GET {$url}{$query} ({$status})";
                }
            }
        }

        $this->assertSame([], $leaks, "Data Secret bocor di:\n".implode("\n", $leaks));
    }

    public function test_auditor_with_secret_clearance_still_sees_it(): void
    {
        $auditor = $this->user('auditor@example.com', ['auditor']);
        $this->actingAs($auditor)->getJson('/api/audit-logs?q='.self::MARKER)->assertOk()->assertJsonFragment(['entity_id' => 'REC-00009', 'entity_label' => 'Rekaman '.self::MARKER]);
        $this->assertStringContainsString(self::MARKER, $this->actingAs($auditor)->getJson('/api/documents/'.$this->ids['document'])->getContent());
    }

    public function test_writes_on_secret_records_and_projects_are_refused_below_clearance(): void
    {
        // Pengelola records & penyusunan, tetapi izin klasifikasi hanya Confidential.
        $manager = $this->user('pengelola@example.com', ['compliance_admin', 'drafter', 'approver']);
        $record = $this->ids['record'];
        $project = $this->ids['project'];

        $this->actingAs($manager)->patchJson("/api/records/{$record}", ['title' => 'Diubah'])->assertForbidden();
        $this->actingAs($manager)->postJson("/api/records/{$record}/action", ['action' => 'dispose', 'disposal_reference' => 'BA-1'])->assertForbidden();
        $this->actingAs($manager)->deleteJson("/api/records/{$record}")->assertForbidden();
        $this->assertSame('active', Record::find($record)->status);

        $this->actingAs($manager)->getJson("/api/drafting-projects/{$project}")->assertForbidden();
        $this->actingAs($manager)->postJson("/api/drafting-projects/{$project}/meetings", ['agenda' => 'x', 'scheduled_at' => now()->toDateTimeString()])->assertForbidden();
        $this->actingAs($manager)->get("/api/drafting-projects/{$project}/final-file")->assertForbidden();
    }
}
