<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\User;
use App\Services\DocumentNumbering;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NumberingSettingTest extends TestCase
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

    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'format' => '{type}-{function}-{year}-{seq}',
            'seq_padding' => 4,
            'type_codes' => [
                'Kebijakan' => 'KBJ', 'Manual' => 'MAN', 'SOP' => 'SOP',
                'Work Instruction' => 'WI', 'Formulir' => 'FRM',
            ],
        ], $overrides);
    }

    public function test_non_masterdata_user_cannot_view_settings(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');

        $this->actingAs($viewer)->getJson('/api/numbering-settings')->assertStatus(403);
    }

    public function test_sysadmin_sees_default_settings(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $response = $this->actingAs($sysadmin)->getJson('/api/numbering-settings');

        $response->assertOk()
            ->assertJsonPath('format', '{type}-{function}-{seq}')
            ->assertJsonPath('type_codes.SOP', 'SOP');
    }

    public function test_sysadmin_can_update_format(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $response = $this->actingAs($sysadmin)->postJson('/api/numbering-settings', $this->validPayload());

        $response->assertOk()->assertJsonPath('format', '{type}-{function}-{year}-{seq}');
        $this->assertDatabaseHas('numbering_settings', ['id' => 1, 'seq_padding' => 4]);
    }

    public function test_format_must_end_with_seq_token(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $response = $this->actingAs($sysadmin)->postJson('/api/numbering-settings', $this->validPayload([
            'format' => '{seq}-{type}-{function}',
        ]));

        $response->assertStatus(422)->assertJsonValidationErrors('format');
    }

    public function test_unknown_token_is_rejected(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $response = $this->actingAs($sysadmin)->postJson('/api/numbering-settings', $this->validPayload([
            'format' => '{type}-{unknown}-{seq}',
        ]));

        $response->assertStatus(422)->assertJsonValidationErrors('format');
    }

    public function test_type_codes_must_match_known_types_exactly(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');

        $missingOne = $this->validPayload();
        unset($missingOne['type_codes']['Formulir']);

        $this->actingAs($sysadmin)->postJson('/api/numbering-settings', $missingOne)
            ->assertStatus(422)->assertJsonValidationErrors('type_codes');

        $extraKey = $this->validPayload();
        $extraKey['type_codes']['Ekstra'] = 'EXT';

        $this->actingAs($sysadmin)->postJson('/api/numbering-settings', $extraKey)
            ->assertStatus(422)->assertJsonValidationErrors('type_codes');
    }

    public function test_next_code_honors_customized_format(): void
    {
        $this->activateLicense();
        $sysadmin = $this->makeUser('sysadmin');
        OrgFunction::firstOrCreate(['id' => 'qa'], ['name' => 'Quality Assurance', 'active' => true]);

        $this->actingAs($sysadmin)->postJson('/api/numbering-settings', $this->validPayload([
            'format' => '{type}/{function}/{yy}/{seq}',
            'seq_padding' => 2,
        ]))->assertOk();

        $numbering = app(DocumentNumbering::class);
        $code = $numbering->nextCode('SOP', 'qa');

        $this->assertSame('SOP/QA/'.now()->format('y').'/01', $code);

        // Buat dokumen dengan kode itu lalu pastikan urutan berikutnya naik.
        Document::create([
            'code' => $code, 'title' => 'Dok 1', 'type' => 'SOP', 'function_id' => 'qa',
            'classification' => 'internal', 'status' => 'draft', 'validity' => 'belum_berlaku',
            'version' => '1.0', 'revision_number' => 0,
        ]);

        $this->assertSame('SOP/QA/'.now()->format('y').'/02', $numbering->nextCode('SOP', 'qa'));
    }
}
