<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
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

    private function makeDocument(string $status, array $overrides = []): Document
    {
        $fn = OrgFunction::firstOrCreate(['id' => 'qa'], ['name' => 'Quality Assurance', 'active' => true]);

        return Document::create(array_merge([
            'code' => 'SOP-QA-'.random_int(1000, 9999),
            'title' => 'Dokumen Uji '.$status,
            'type' => 'SOP',
            'function_id' => $fn->id,
            'classification' => 'internal',
            'status' => $status,
            'validity' => 'belum_berlaku',
            'version' => '1.0',
            'revision_number' => 0,
        ], $overrides));
    }

    public function test_status_and_classification_breakdown_counts_are_correct(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');
        $this->makeDocument('draft');
        $this->makeDocument('review');
        $this->makeDocument('released');
        $this->makeDocument('released');

        $response = $this->actingAs($viewer)->getJson('/api/dashboard');

        $response->assertOk();
        $this->assertSame(4, $response->json('totals.documents'));
        $this->assertSame(2, $response->json('totals.released'));
        $this->assertSame(2, $response->json('totals.pending')); // draft + review

        $breakdown = collect($response->json('status_breakdown'))->keyBy('key');
        $this->assertSame(1, $breakdown['draft']['count']);
        $this->assertSame(1, $breakdown['review']['count']);
        $this->assertSame(2, $breakdown['released']['count']);
        $this->assertSame(0, $breakdown['obsolete']['count']);
    }

    public function test_overdue_and_upcoming_review_counts(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');
        $this->makeDocument('released', ['review_date' => now()->subDays(5)]);
        $this->makeDocument('released', ['review_date' => now()->addDays(10)]);
        $this->makeDocument('released', ['review_date' => now()->addDays(90)]);

        $response = $this->actingAs($viewer)->getJson('/api/dashboard');

        $this->assertSame(1, $response->json('totals.overdue_review'));
        $this->assertSame(1, $response->json('totals.upcoming_review'));
    }

    public function test_my_actionable_reflects_role_transition_authority(): void
    {
        $this->activateLicense();
        $reviewer = $this->makeUser('reviewer');
        $this->makeDocument('review');
        $this->makeDocument('approval'); // bukan wewenang reviewer

        $response = $this->actingAs($reviewer)->getJson('/api/dashboard');

        $this->assertSame(1, $response->json('totals.my_actionable'));
    }

    public function test_restricted_blocks_are_null_for_unauthorized_role(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');

        $response = $this->actingAs($viewer)->getJson('/api/dashboard');

        $response->assertOk();
        $this->assertNull($response->json('users'));
        $this->assertNull($response->json('recent_activity'));
        $this->assertNull($response->json('monthly_trend'));
    }

    public function test_users_manage_role_sees_user_counts(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');
        User::factory()->create(['active' => true]);
        User::factory()->create(['active' => false]);

        $response = $this->actingAs($sysadmin)->getJson('/api/dashboard');

        // sysadmin sendiri (active) + 2 pabrik = 2 aktif, 1 nonaktif.
        $this->assertSame(2, $response->json('users.active'));
        $this->assertSame(1, $response->json('users.inactive'));
    }

    public function test_audit_view_role_sees_recent_activity(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');
        app(AuditLogger::class)->log($auditor, 'create', 'Document', '1', 'SOP-QA-0001', 'Membuat dokumen uji.');

        $response = $this->actingAs($auditor)->getJson('/api/dashboard');

        $this->assertNotNull($response->json('recent_activity'));
        $this->assertGreaterThanOrEqual(1, count($response->json('recent_activity')));
    }

    public function test_reporting_view_role_sees_six_month_trend(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $this->makeDocument('draft');

        $response = $this->actingAs($controller)->getJson('/api/dashboard');

        $trend = $response->json('monthly_trend');
        $this->assertNotNull($trend);
        $this->assertCount(6, $trend);
        $this->assertSame(now()->format('Y-m'), $trend[5]['month']);
        $this->assertSame(1, $trend[5]['count']);
    }
}
