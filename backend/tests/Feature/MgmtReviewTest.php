<?php

namespace Tests\Feature;

use App\Models\Finding;
use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MgmtReviewTest extends TestCase
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

    private function schedule(User $chair, array $overrides = []): array
    {
        return $this->actingAs($chair)->postJson('/api/mgmt-reviews', array_merge([
            'title' => 'Tinjauan Manajemen Semester 1 2026',
            'meeting_date' => now()->addDays(14)->toDateString(),
            'attendees' => 'Direktur, MR, Kepala QA',
        ], $overrides))->assertCreated()->json();
    }

    public function test_user_without_view_permission_is_forbidden(): void
    {
        $this->activateLicense();
        $drafter = $this->makeUser('drafter');

        $this->actingAs($drafter)->getJson('/api/mgmt-reviews')->assertStatus(403);
    }

    public function test_viewer_can_read_but_not_schedule(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');

        $this->actingAs($viewer)->getJson('/api/mgmt-reviews')->assertOk();
        $this->actingAs($viewer)->postJson('/api/mgmt-reviews', [
            'title' => 'X', 'meeting_date' => now()->toDateString(),
        ])->assertStatus(403);
    }

    public function test_chair_can_schedule_with_sequential_code(): void
    {
        $this->activateLicense();
        $chair = $this->makeUser('ratifier');

        $first = $this->schedule($chair);
        $second = $this->schedule($chair);

        $this->assertSame('MR-0001', $first['code']);
        $this->assertSame('MR-0002', $second['code']);
        $this->assertSame('scheduled', $first['status']);
    }

    public function test_cannot_complete_without_any_output(): void
    {
        $this->activateLicense();
        $chair = $this->makeUser('ratifier');
        $review = $this->schedule($chair);

        $this->actingAs($chair)->postJson("/api/mgmt-reviews/{$review['id']}/transition", ['action' => 'complete'])
            ->assertStatus(422);
    }

    public function test_complete_after_filling_output_then_locked_from_edit(): void
    {
        $this->activateLicense();
        $chair = $this->makeUser('ratifier');
        $review = $this->schedule($chair);

        $this->actingAs($chair)->patchJson("/api/mgmt-reviews/{$review['id']}", [
            'performance_summary' => 'Kepuasan pelanggan 87%, sasaran mutu tercapai 9 dari 10.',
            'decisions' => 'Tambah pelatihan operator lini 2.',
        ])->assertOk();

        $this->actingAs($chair)->postJson("/api/mgmt-reviews/{$review['id']}/transition", ['action' => 'complete'])
            ->assertOk()
            ->assertJsonPath('status', 'completed');

        $this->actingAs($chair)->patchJson("/api/mgmt-reviews/{$review['id']}", ['decisions' => 'Diubah'])
            ->assertStatus(422);
    }

    public function test_cancel_only_from_scheduled(): void
    {
        $this->activateLicense();
        $chair = $this->makeUser('ratifier');
        $review = $this->schedule($chair);

        $this->actingAs($chair)->postJson("/api/mgmt-reviews/{$review['id']}/transition", ['action' => 'cancel'])
            ->assertOk()
            ->assertJsonPath('status', 'cancelled');

        $this->actingAs($chair)->postJson("/api/mgmt-reviews/{$review['id']}/transition", ['action' => 'cancel'])
            ->assertStatus(422);
    }

    public function test_action_items_can_be_added_and_updated_even_after_completion(): void
    {
        $this->activateLicense();
        $chair = $this->makeUser('ratifier');
        $review = $this->schedule($chair);

        $action = $this->actingAs($chair)->postJson("/api/mgmt-reviews/{$review['id']}/actions", [
            'description' => 'Susun rencana pelatihan operator',
            'pic' => 'Kepala HRD',
            'due_date' => now()->addMonth()->toDateString(),
        ])->assertCreated()->json();
        $this->assertSame('open', $action['status']);

        $this->actingAs($chair)->patchJson("/api/mgmt-reviews/{$review['id']}", ['decisions' => 'Pelatihan operator.']);
        $this->actingAs($chair)->postJson("/api/mgmt-reviews/{$review['id']}/transition", ['action' => 'complete'])->assertOk();

        $this->actingAs($chair)->patchJson("/api/mgmt-reviews/{$review['id']}/actions/{$action['id']}", ['status' => 'completed'])
            ->assertOk()
            ->assertJsonPath('status', 'completed');
    }

    public function test_action_of_another_review_returns_404(): void
    {
        $this->activateLicense();
        $chair = $this->makeUser('ratifier');
        $a = $this->schedule($chair);
        $b = $this->schedule($chair);
        $action = $this->actingAs($chair)->postJson("/api/mgmt-reviews/{$a['id']}/actions", ['description' => 'X'])->json();

        $this->actingAs($chair)->patchJson("/api/mgmt-reviews/{$b['id']}/actions/{$action['id']}", ['status' => 'completed'])
            ->assertNotFound();
    }

    public function test_cancelled_review_rejects_new_actions(): void
    {
        $this->activateLicense();
        $chair = $this->makeUser('ratifier');
        $review = $this->schedule($chair);
        $this->actingAs($chair)->postJson("/api/mgmt-reviews/{$review['id']}/transition", ['action' => 'cancel']);

        $this->actingAs($chair)->postJson("/api/mgmt-reviews/{$review['id']}/actions", ['description' => 'X'])
            ->assertStatus(422);
    }

    public function test_index_includes_live_snapshot_from_other_modules(): void
    {
        $this->activateLicense();
        $chair = $this->makeUser('ratifier');
        Finding::create(['code' => 'FIND-0001', 'type' => 'nc_major', 'status' => 'open', 'audit_source' => 'internal', 'title' => 'A']);
        Finding::create(['code' => 'FIND-0002', 'type' => 'ofi', 'status' => 'closed', 'audit_source' => 'internal', 'title' => 'B']);

        $snapshot = $this->actingAs($chair)->getJson('/api/mgmt-reviews')->assertOk()->json('snapshot');

        $this->assertSame(1, $snapshot['findings_open']);
        $this->assertSame(1, $snapshot['findings_nc_major_open']);
        $this->assertSame(1, $snapshot['findings_closed']);
    }
}
