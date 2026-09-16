<?php

namespace Tests\Feature;

use App\Models\OrgFunction;
use App\Models\Risk;
use App\Models\Role;
use App\Models\Standard;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class RiskRegisterTest extends TestCase
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

    private function makeUser(?string $roleId = null): User
    {
        $user = User::create([
            'name' => 'Pengguna '.($roleId ?? 'tanpa-peran'),
            'email' => ($roleId ?? 'norole').'@example.com',
            'password' => 'rahasia-panjang-sekali',
            'active' => true,
            'must_change_password' => false,
        ]);
        if ($roleId) {
            Role::firstOrCreate(['id' => $roleId], ['label' => ucfirst($roleId)]);
            $user->roles()->attach($roleId);
        }

        return $user;
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Kebocoran data pelanggan',
            'description' => 'Risiko kebocoran data akibat kontrol akses lemah.',
            'category' => 'security',
            'treatment' => 'reduce',
            'treatment_plan' => 'Implementasi MFA & audit akses berkala.',
            'inherent_likelihood' => 4,
            'inherent_impact' => 5,
            'residual_likelihood' => 2,
            'residual_impact' => 3,
        ], $overrides);
    }

    public function test_user_without_any_role_cannot_view_risk_register(): void
    {
        $this->activateLicense();
        $noRole = $this->makeUser();

        $this->actingAs($noRole)->getJson('/api/risks')->assertStatus(403);
    }

    public function test_viewer_can_view_but_not_create(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');

        $this->actingAs($viewer)->getJson('/api/risks')->assertOk();
        $this->actingAs($viewer)->postJson('/api/risks', $this->payload())->assertStatus(403);
    }

    public function test_function_head_can_create_risk_with_computed_levels(): void
    {
        $this->activateLicense();
        $functionHead = $this->makeUser('function_head');

        $response = $this->actingAs($functionHead)->postJson('/api/risks', $this->payload());

        $response->assertCreated();
        $this->assertSame('RISK-0001', $response->json('code'));
        $this->assertSame('extreme', $response->json('inherent_level')); // 4*5=20
        $this->assertSame('moderate', $response->json('residual_level')); // 2*3=6
    }

    public function test_codes_increment_sequentially(): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');

        $first = $this->actingAs($complianceAdmin)->postJson('/api/risks', $this->payload());
        $second = $this->actingAs($complianceAdmin)->postJson('/api/risks', $this->payload(['title' => 'Risiko lain']));

        $this->assertSame('RISK-0001', $first->json('code'));
        $this->assertSame('RISK-0002', $second->json('code'));
    }

    #[DataProvider('levelCombinations')]
    public function test_level_scoring_matches_iso_31000_matrix(int $likelihood, int $impact, string $expected): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');

        $response = $this->actingAs($complianceAdmin)->postJson('/api/risks', $this->payload([
            'inherent_likelihood' => $likelihood,
            'inherent_impact' => $impact,
        ]));

        $this->assertSame($expected, $response->json('inherent_level'));
    }

    public static function levelCombinations(): array
    {
        return [
            'low (1x1=1)' => [1, 1, 'low'],
            'low boundary (5x1=5)' => [5, 1, 'low'],
            'moderate boundary (2x3=6)' => [2, 3, 'moderate'],
            'high boundary (3x4=12)' => [3, 4, 'high'],
            'extreme boundary (4x5=20)' => [4, 5, 'extreme'],
            'extreme max (5x5=25)' => [5, 5, 'extreme'],
        ];
    }

    public function test_invalid_category_is_rejected(): void
    {
        $this->activateLicense();
        $functionHead = $this->makeUser('function_head');

        $this->actingAs($functionHead)
            ->postJson('/api/risks', $this->payload(['category' => 'tidak_dikenal']))
            ->assertStatus(422);
    }

    public function test_likelihood_out_of_range_is_rejected(): void
    {
        $this->activateLicense();
        $functionHead = $this->makeUser('function_head');

        $this->actingAs($functionHead)
            ->postJson('/api/risks', $this->payload(['residual_likelihood' => 6]))
            ->assertStatus(422);
    }

    public function test_update_recomputes_residual_level(): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');
        $created = $this->actingAs($complianceAdmin)->postJson('/api/risks', $this->payload());
        $riskId = $created->json('id');
        $this->assertSame('moderate', $created->json('residual_level')); // 2x3=6

        $response = $this->actingAs($complianceAdmin)->patchJson("/api/risks/{$riskId}", [
            'residual_likelihood' => 1,
            'residual_impact' => 1,
        ]);

        $response->assertOk();
        $this->assertSame('low', $response->json('residual_level'));
    }

    public function test_viewer_cannot_update_risk(): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');
        $viewer = $this->makeUser('viewer');
        $created = $this->actingAs($complianceAdmin)->postJson('/api/risks', $this->payload());

        $this->actingAs($viewer)
            ->patchJson("/api/risks/{$created->json('id')}", ['status' => 'closed'])
            ->assertStatus(403);
    }

    public function test_add_control_appears_on_risk(): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');
        $created = $this->actingAs($complianceAdmin)->postJson('/api/risks', $this->payload());

        $response = $this->actingAs($complianceAdmin)
            ->postJson("/api/risks/{$created->json('id')}/controls", ['description' => 'Kebijakan MFA wajib untuk seluruh akun admin.']);

        $response->assertCreated();

        $list = $this->actingAs($complianceAdmin)->getJson('/api/risks');
        $risk = collect($list->json('risks'))->firstWhere('id', $created->json('id'));
        $this->assertCount(1, $risk['controls']);
    }

    public function test_standards_are_synced_on_create_and_update(): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');
        Standard::create(['code' => 'ISO27001', 'name' => 'ISO/IEC 27001', 'active' => true]);
        Standard::create(['code' => 'ISO31000', 'name' => 'ISO 31000', 'active' => true]);

        $created = $this->actingAs($complianceAdmin)->postJson('/api/risks', $this->payload(['standards' => ['ISO27001']]));
        $this->assertSame(['ISO27001'], collect($created->json('standards'))->pluck('code')->all());

        $updated = $this->actingAs($complianceAdmin)->patchJson("/api/risks/{$created->json('id')}", ['standards' => ['ISO27001', 'ISO31000']]);
        $this->assertEqualsCanonicalizing(['ISO27001', 'ISO31000'], collect($updated->json('standards'))->pluck('code')->all());
    }

    public function test_filters_by_category_level_status_and_function(): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');
        $fn = OrgFunction::create(['id' => 'it', 'name' => 'Information Technology', 'active' => true]);

        $this->actingAs($complianceAdmin)->postJson('/api/risks', $this->payload([
            'category' => 'security', 'function_id' => $fn->id, 'residual_likelihood' => 1, 'residual_impact' => 1,
        ]));
        $this->actingAs($complianceAdmin)->postJson('/api/risks', $this->payload([
            'title' => 'Risiko keuangan', 'category' => 'financial', 'residual_likelihood' => 5, 'residual_impact' => 5,
        ]));

        $byCategory = $this->actingAs($complianceAdmin)->getJson('/api/risks?category=financial');
        $this->assertCount(1, $byCategory->json('risks'));

        $byLevel = $this->actingAs($complianceAdmin)->getJson('/api/risks?residual_level=extreme');
        $this->assertCount(1, $byLevel->json('risks'));

        $byFunction = $this->actingAs($complianceAdmin)->getJson("/api/risks?function_id={$fn->id}");
        $this->assertCount(1, $byFunction->json('risks'));
    }

    public function test_index_is_sorted_by_residual_severity_descending(): void
    {
        $this->activateLicense();
        $complianceAdmin = $this->makeUser('compliance_admin');

        $this->actingAs($complianceAdmin)->postJson('/api/risks', $this->payload([
            'title' => 'Low one', 'residual_likelihood' => 1, 'residual_impact' => 1,
        ]));
        $this->actingAs($complianceAdmin)->postJson('/api/risks', $this->payload([
            'title' => 'Extreme one', 'residual_likelihood' => 5, 'residual_impact' => 5,
        ]));

        $response = $this->actingAs($complianceAdmin)->getJson('/api/risks');
        $this->assertSame('Extreme one', $response->json('risks.0.title'));
        $this->assertSame('Low one', $response->json('risks.1.title'));
    }
}
