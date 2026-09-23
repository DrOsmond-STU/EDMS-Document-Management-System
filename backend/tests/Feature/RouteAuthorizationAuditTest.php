<?php

namespace Tests\Feature;

use App\Models\AiGeneration;
use App\Models\AppNotification;
use App\Models\Audit;
use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\DocumentComment;
use App\Models\DocumentFile;
use App\Models\DocumentFolder;
use App\Models\DraftingMeeting;
use App\Models\DraftingMeetingAttendee;
use App\Models\DraftingMeetingPhoto;
use App\Models\DraftingProject;
use App\Models\Finding;
use App\Models\FindingAction;
use App\Models\LegalRequirement;
use App\Models\MgmtReview;
use App\Models\MgmtReviewAction;
use App\Models\OrgFunction;
use App\Models\Record;
use App\Models\RecordSeries;
use App\Models\Risk;
use App\Models\RiskControl;
use App\Models\Role;
use App\Models\Standard;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Audit otorisasi menyeluruh: SETIAP route API dipanggil oleh pengguna
 * tanpa peran dan oleh "viewer" (hanya baca dokumen terbit). Route tulis
 * wajib ditolak (403/404), route baca tidak boleh membocorkan data modul
 * yang tidak menjadi haknya. Route baru yang lupa diberi pemeriksaan hak
 * akses akan otomatis tertangkap tes ini.
 */
class RouteAuthorizationAuditTest extends TestCase
{
    use RefreshDatabase;

    /** Route yang memang boleh dipanggil siapa pun yang sudah login (miliknya sendiri / publik). */
    private const OPEN_FOR_ANY_USER = [
        'POST api/auth/logout', 'GET api/auth/me', 'POST api/auth/change-password',
        'GET api/company-settings', 'GET api/company-settings/logo', 'GET api/company-settings/sidebar-logo',
        'GET api/license-status', 'GET api/csrf-cookie', 'POST api/auth/login', 'POST api/license/apply',
        'GET api/notifications', 'POST api/notifications/read-all', 'GET api/dashboard', 'GET api/search',
        'GET api/knowledge/overview', 'GET api/discussions', 'GET api/folders', 'GET api/documents',
        'GET api/approval-board', 'GET api/master-data',
        // daftar isi folder/kategori — disaring Document::visibleTo (lihat uji kebocoran di bawah)
        'GET api/folders/{folder}/documents', 'GET api/document-categories/{category}/documents',
    ];

    /** Teks yang hanya ada di data milik pengguna lain / dokumen draft — tidak boleh muncul di respons penyerang. */
    private const SECRETS = ['Draft rahasia', 'SOP-HSE-001', 'komentar-rahasia-xyz'];

    private array $bodies = [];

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

        $owner = $this->makeUser('owner@example.com', ['sysadmin', 'compliance_admin', 'controller']);
        OrgFunction::create(['id' => 'hse', 'name' => 'HSE', 'active' => true]);
        Standard::create(['code' => 'ISO9001', 'name' => 'ISO 9001', 'active' => true]);

        $doc = Document::create(['code' => 'SOP-HSE-001', 'title' => 'Draft rahasia', 'type' => 'SOP', 'function_id' => 'hse', 'classification' => 'confidential',
            'status' => 'draft', 'validity' => 'belum_berlaku', 'version' => '0.1', 'revision_number' => 0, 'created_by' => $owner->id]);
        $file = DocumentFile::create(['document_id' => $doc->id, 'original_name' => 'a.pdf', 'disk' => 'local', 'stored_path' => 'documents/a.pdf',
            'mime_type' => 'application/pdf', 'size_bytes' => 10, 'checksum_sha256' => str_repeat('a', 64), 'is_primary' => true, 'uploaded_by' => $owner->id, 'uploaded_by_name' => 'x']);
        $risk = Risk::create(['code' => 'RISK-0001', 'title' => 'R', 'category' => 'safety', 'inherent_likelihood' => 1, 'inherent_impact' => 1, 'inherent_level' => 'low',
            'residual_likelihood' => 1, 'residual_impact' => 1, 'residual_level' => 'low', 'treatment' => 'accept', 'status' => 'identified']);
        $control = RiskControl::create(['risk_id' => $risk->id, 'description' => 'C', 'created_by' => $owner->id]);
        $series = RecordSeries::create(['code' => 'REK', 'name' => 'Rek', 'retention_active_years' => 1, 'retention_inactive_years' => 1, 'disposition' => 'destroy', 'active' => true]);
        $record = Record::create(['code' => 'REC-00001', 'series_id' => $series->id, 'title' => 'R', 'record_date' => now(), 'medium' => 'physical', 'classification' => 'internal',
            'status' => 'active', 'active_until' => now()->addYear(), 'inactive_until' => now()->addYears(2), 'legal_hold' => false]);
        $legal = LegalRequirement::create(['code' => 'LEG-0001', 'title' => 'L', 'regulation_type' => 'pp', 'category' => 'umum', 'status' => 'active']);
        $audit = Audit::create(['code' => 'AUD-INT-2026-001', 'type' => 'internal', 'title' => 'A', 'planned_start' => now(), 'planned_end' => now(), 'status' => 'planned']);
        $review = MgmtReview::create(['code' => 'MR-2026-001', 'title' => 'M', 'meeting_date' => now(), 'status' => 'scheduled']);
        $mrAction = MgmtReviewAction::create(['mgmt_review_id' => $review->id, 'description' => 'x', 'status' => 'open']);
        $finding = Finding::create(['code' => 'FIND-0001', 'type' => 'ofi', 'audit_source' => 'internal', 'title' => 'F', 'status' => 'open']);
        $fAction = FindingAction::create(['finding_id' => $finding->id, 'type' => 'corrective', 'description' => 'x', 'pic' => 'y', 'status' => 'open']);
        $project = DraftingProject::create(['code' => 'REQ-2026-001', 'title' => 'P', 'doc_type' => 'SOP', 'function_id' => 'hse', 'classification' => 'internal',
            'reason' => 'x', 'requester_id' => $owner->id, 'status' => 'in_progress', 'drafter_id' => $owner->id]);
        $meeting = DraftingMeeting::create(['drafting_project_id' => $project->id, 'session_no' => 1, 'agenda' => 'x', 'scheduled_at' => now()]);
        $attendee = DraftingMeetingAttendee::create(['drafting_meeting_id' => $meeting->id, 'name' => 'n']);
        $photo = DraftingMeetingPhoto::create(['drafting_meeting_id' => $meeting->id, 'path' => 'p.png', 'original_name' => 'p.png', 'mime_type' => 'image/png']);
        $comment = DocumentComment::create(['document_id' => $doc->id, 'user_id' => $owner->id, 'body' => 'komentar-rahasia-xyz']);
        $notification = AppNotification::create(['user_id' => $owner->id, 'type' => 'x', 'title' => 't', 'body' => 'b']);
        $folder = DocumentFolder::create(['name' => 'F', 'created_by' => $owner->id]);
        $category = DocumentCategory::create(['name' => 'C', 'color' => '#000000']);
        $generation = AiGeneration::create(['user_id' => $owner->id, 'kind' => 'draft', 'subject' => 's', 'model' => 'm']);

        $this->ids = [
            'document' => $doc->id, 'file' => $file->id, 'risk' => $risk->id, 'control' => $control->id,
            'recordSeries' => $series->id, 'record' => $record->id, 'legalRequirement' => $legal->id, 'audit' => $audit->id,
            'mgmtReview' => $review->id, 'finding' => $finding->id, 'project' => $project->id, 'meeting' => $meeting->id,
            'attendee' => $attendee->id, 'photo' => $photo->id, 'comment' => $comment->id, 'notification' => $notification->id,
            'folder' => $folder->id, 'category' => $category->id, 'user' => $owner->id, 'orgFunction' => 'hse', 'standard' => 'ISO9001',
            'type' => 'smtp', 'generation' => $generation->id,
            // {action} dipakai dua modul — diganti per-URI di bawah.
            'mrAction' => $mrAction->id, 'fAction' => $fAction->id,
        ];
    }

    private function makeUser(string $email, array $roles = []): User
    {
        $user = User::create(['name' => $email, 'email' => $email, 'password' => 'rahasia-panjang-sekali', 'active' => true, 'must_change_password' => false]);
        foreach ($roles as $roleId) {
            Role::firstOrCreate(['id' => $roleId], ['label' => ucfirst($roleId)]);
            $user->roles()->attach($roleId);
        }

        return $user;
    }

    private function url(LaravelRoute $route): string
    {
        $uri = $route->uri();
        $ids = $this->ids;
        $ids['action'] = str_contains($uri, 'mgmt-reviews') ? $ids['mrAction'] : $ids['fAction'];

        return '/'.preg_replace_callback('/\{(\w+)\}/', fn ($m) => (string) ($ids[$m[1]] ?? 999999), $uri);
    }

    /** @return array<string, int> "METHOD uri" => status */
    private function sweep(User $user): array
    {
        $results = [];
        foreach (Route::getRoutes() as $route) {
            if (! str_starts_with($route->uri(), 'api/')) {
                continue;
            }
            foreach (array_diff($route->methods(), ['HEAD']) as $method) {
                $key = "{$method} {$route->uri()}";
                if (in_array($key, ['POST api/auth/logout', 'POST api/auth/login', 'POST api/license/apply'], true)) {
                    continue; // logout akan memutus sesi sweep; login/apply publik
                }
                $this->actingAs($user);
                $response = $this->json($method, $this->url($route), []);
                $results[$key] = $response->status();
                if ($method === 'GET') {
                    $this->bodies[$key] = (string) $response->getContent();
                }
            }
        }

        return $results;
    }

    public function test_user_without_roles_cannot_write_or_read_protected_modules(): void
    {
        $nobody = $this->makeUser('nobody@example.com');
        $results = $this->sweep($nobody);

        $problems = collect($results)->filter(function (int $status, string $key) {
            if (in_array($key, self::OPEN_FOR_ANY_USER, true)) {
                return $status >= 500;
            }

            return ! in_array($status, [401, 403, 404], true);
        });

        $this->assertSame([], $problems->all(), "Route yang tidak menolak pengguna tanpa peran:\n".$problems->map(fn ($s, $k) => "$s  $k")->implode("\n"));
        $this->assertNoLeak();
    }

    private function assertNoLeak(): void
    {
        $leaks = [];
        foreach ($this->bodies as $key => $body) {
            foreach (self::SECRETS as $secret) {
                if (str_contains($body, $secret)) {
                    $leaks[] = "{$key} memuat \"{$secret}\"";
                }
            }
        }
        $this->assertSame([], $leaks, "Kebocoran data:\n".implode("\n", $leaks));
    }

    public function test_viewer_cannot_write_anything(): void
    {
        $viewer = $this->makeUser('viewer@example.com', ['viewer']);
        $results = $this->sweep($viewer);

        $allowedWrites = ['POST api/auth/change-password', 'POST api/notifications/read-all'];
        $problems = collect($results)->filter(function (int $status, string $key) use ($allowedWrites) {
            [$method] = explode(' ', $key, 2);
            if ($method === 'GET' || in_array($key, $allowedWrites, true)) {
                return $status >= 500;
            }

            return ! in_array($status, [401, 403, 404], true);
        });

        $this->assertSame([], $problems->all(), "Route tulis yang tidak menolak viewer:\n".$problems->map(fn ($s, $k) => "$s  $k")->implode("\n"));
        $this->assertNoLeak();
    }
}
