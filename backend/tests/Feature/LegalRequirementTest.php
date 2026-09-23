<?php

namespace Tests\Feature;

use App\Models\LegalRequirement;
use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LegalRequirementTest extends TestCase
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

    private function create(User $user, array $overrides = []): array
    {
        return $this->actingAs($user)->postJson('/api/legal-requirements', array_merge([
            'title' => 'Penyelenggaraan Perlindungan dan Pengelolaan Lingkungan Hidup',
            'regulation_number' => 'PP No. 22 Tahun 2021',
            'regulation_type' => 'pp',
            'issuer' => 'Pemerintah Republik Indonesia',
            'category' => 'lingkungan',
            'obligations' => 'Memiliki persetujuan lingkungan; menyampaikan laporan RKL-RPL tiap semester.',
        ], $overrides))->assertCreated()->json();
    }

    public function test_viewer_can_read_but_not_add(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');

        $this->actingAs($viewer)->getJson('/api/legal-requirements')->assertOk();
        $this->actingAs($viewer)->postJson('/api/legal-requirements', [
            'title' => 'X', 'regulation_type' => 'pp', 'category' => 'umum',
        ])->assertStatus(403);
    }

    public function test_new_item_starts_active_and_not_evaluated(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('compliance_admin');

        $item = $this->create($admin);

        $this->assertSame('LEG-0001', $item['code']);
        $this->assertSame('active', $item['status']);
        $this->assertSame('not_evaluated', $item['compliance_status']);
    }

    public function test_compliance_status_cannot_be_set_via_update(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('compliance_admin');
        $item = $this->create($admin);

        $this->actingAs($admin)->patchJson("/api/legal-requirements/{$item['id']}", ['compliance_status' => 'compliant'])
            ->assertOk();

        $this->assertDatabaseHas('legal_requirements', ['id' => $item['id'], 'compliance_status' => 'not_evaluated']);
    }

    public function test_evaluation_updates_status_and_keeps_history(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('compliance_admin');
        $item = $this->create($admin);

        $this->actingAs($admin)->postJson("/api/legal-requirements/{$item['id']}/evaluations", [
            'compliance_status' => 'partial',
            'evaluation_date' => now()->subMonth()->toDateString(),
            'evidence' => 'Laporan RKL-RPL semester 1 belum disampaikan.',
        ])->assertOk();

        $response = $this->actingAs($admin)->postJson("/api/legal-requirements/{$item['id']}/evaluations", [
            'compliance_status' => 'compliant',
            'evaluation_date' => now()->toDateString(),
            'next_evaluation_at' => now()->addMonths(6)->toDateString(),
        ]);

        $response->assertOk();
        $this->assertSame('compliant', $response->json('compliance_status'));
        $this->assertCount(2, $response->json('evaluations'));
        $this->assertSame('compliant', $response->json('evaluations.0.compliance_status'));
        $this->assertNotNull($response->json('next_evaluation_at'));
    }

    public function test_backdated_evaluation_does_not_override_newer_status(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('compliance_admin');
        $item = $this->create($admin);

        $this->actingAs($admin)->postJson("/api/legal-requirements/{$item['id']}/evaluations", [
            'compliance_status' => 'compliant', 'evaluation_date' => now()->toDateString(),
        ]);
        $response = $this->actingAs($admin)->postJson("/api/legal-requirements/{$item['id']}/evaluations", [
            'compliance_status' => 'non_compliant', 'evaluation_date' => now()->subYear()->toDateString(),
        ]);

        $this->assertSame('compliant', $response->json('compliance_status'));
        $this->assertCount(2, $response->json('evaluations'));
    }

    public function test_future_dated_evaluation_is_rejected(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('compliance_admin');
        $item = $this->create($admin);

        $this->actingAs($admin)->postJson("/api/legal-requirements/{$item['id']}/evaluations", [
            'compliance_status' => 'compliant', 'evaluation_date' => now()->addDay()->toDateString(),
        ])->assertStatus(422);
    }

    public function test_revoked_regulation_cannot_be_evaluated(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('compliance_admin');
        $item = $this->create($admin);
        $this->actingAs($admin)->patchJson("/api/legal-requirements/{$item['id']}", ['status' => 'revoked'])->assertOk();

        $this->actingAs($admin)->postJson("/api/legal-requirements/{$item['id']}/evaluations", [
            'compliance_status' => 'compliant', 'evaluation_date' => now()->toDateString(),
        ])->assertStatus(422);
    }

    public function test_stats_count_only_active_and_flag_overdue_evaluations(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('compliance_admin');
        $a = $this->create($admin);
        $b = $this->create($admin, ['title' => 'UU Cipta Kerja', 'regulation_type' => 'uu', 'category' => 'ketenagakerjaan']);
        $this->create($admin, ['title' => 'Peraturan lama']);
        LegalRequirement::where('title', 'Peraturan lama')->update(['status' => 'replaced']);
        LegalRequirement::whereKey($b['id'])->update(['next_evaluation_at' => now()->subDay()->toDateString()]);
        $this->actingAs($admin)->postJson("/api/legal-requirements/{$a['id']}/evaluations", [
            'compliance_status' => 'non_compliant', 'evaluation_date' => now()->toDateString(),
        ]);

        $response = $this->actingAs($admin)->getJson('/api/legal-requirements');

        $this->assertSame(2, $response->json('stats.total_active'));
        $this->assertSame(1, $response->json('stats.non_compliant'));
        $this->assertSame(1, $response->json('stats.not_evaluated'));
        $this->assertSame(1, $response->json('stats.evaluation_overdue'));

        $overdue = $this->actingAs($admin)->getJson('/api/legal-requirements?overdue=1')->json('items');
        $this->assertCount(1, $overdue);
        $this->assertSame($b['id'], $overdue[0]['id']);
    }

    public function test_filters_by_category_and_search(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('compliance_admin');
        $this->create($admin);
        $this->create($admin, ['title' => 'Sistem Manajemen K3', 'regulation_number' => 'PP No. 50 Tahun 2012', 'category' => 'k3']);

        $this->assertCount(1, $this->actingAs($admin)->getJson('/api/legal-requirements?category=k3')->json('items'));
        $this->assertCount(1, $this->actingAs($admin)->getJson('/api/legal-requirements?q=50 Tahun 2012')->json('items'));
    }
}
