<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApprovalBoardTest extends TestCase
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

    public function test_viewer_without_lifecycle_involvement_is_forbidden(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');

        $this->actingAs($viewer)->getJson('/api/approval-board')->assertStatus(403);
    }

    public function test_reviewer_sees_all_three_columns_grouped_by_status(): void
    {
        $this->activateLicense();
        $reviewer = $this->makeUser('reviewer');
        $this->makeDocument('draft');
        $this->makeDocument('review');
        $this->makeDocument('approval');
        $this->makeDocument('released'); // tidak boleh muncul di papan

        $response = $this->actingAs($reviewer)->getJson('/api/approval-board');

        $response->assertOk();
        $this->assertCount(1, $response->json('columns.draft'));
        $this->assertCount(1, $response->json('columns.review'));
        $this->assertCount(1, $response->json('columns.approval'));
    }

    public function test_can_act_flag_reflects_role_transition_authority(): void
    {
        $this->activateLicense();
        $reviewer = $this->makeUser('reviewer');
        $this->makeDocument('review');
        $this->makeDocument('approval');

        $response = $this->actingAs($reviewer)->getJson('/api/approval-board');

        // Reviewer boleh mendorong dari "review" tapi bukan dari "approval".
        $this->assertTrue($response->json('columns.review.0.can_act'));
        $this->assertFalse($response->json('columns.approval.0.can_act'));
        $this->assertSame('approval', $response->json('columns.review.0.next_status'));
    }

    public function test_controller_can_act_on_every_stage(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $this->makeDocument('draft');
        $this->makeDocument('review');
        $this->makeDocument('approval');

        $response = $this->actingAs($controller)->getJson('/api/approval-board');

        $this->assertTrue($response->json('columns.draft.0.can_act'));
        $this->assertTrue($response->json('columns.review.0.can_act'));
        $this->assertTrue($response->json('columns.approval.0.can_act'));
    }

    public function test_auditor_can_view_board_read_only(): void
    {
        $this->activateLicense();
        $auditor = $this->makeUser('auditor');
        $this->makeDocument('review');

        $response = $this->actingAs($auditor)->getJson('/api/approval-board');

        $response->assertOk();
        $this->assertFalse($response->json('columns.review.0.can_act'));
    }
}
