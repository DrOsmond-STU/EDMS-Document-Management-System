<?php

namespace Tests\Feature;

use App\Models\Record;
use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RecordsTest extends TestCase
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

    private function series(User $user, array $overrides = []): array
    {
        return $this->actingAs($user)->postJson('/api/record-series', array_merge([
            'code' => 'REK-PLT',
            'name' => 'Rekaman Pelatihan Karyawan',
            'retention_active_years' => 2,
            'retention_inactive_years' => 3,
            'disposition' => 'destroy',
        ], $overrides))->assertCreated()->json();
    }

    private function record(User $user, int $seriesId, string $recordDate, array $overrides = []): array
    {
        return $this->actingAs($user)->postJson('/api/records', array_merge([
            'series_id' => $seriesId,
            'title' => 'Daftar hadir pelatihan K3',
            'record_date' => $recordDate,
            'medium' => 'physical',
            'location' => 'Lemari A / Rak 2 / Box 5',
        ], $overrides))->assertCreated()->json();
    }

    public function test_viewer_can_read_but_not_register(): void
    {
        $this->activateLicense();
        $viewer = $this->makeUser('viewer');

        $this->actingAs($viewer)->getJson('/api/records')->assertOk();
        $this->actingAs($viewer)->getJson('/api/record-series')->assertOk();
        $this->actingAs($viewer)->postJson('/api/record-series', [
            'code' => 'X', 'name' => 'X', 'retention_active_years' => 1, 'retention_inactive_years' => 1, 'disposition' => 'destroy',
        ])->assertStatus(403);
    }

    public function test_record_inherits_retention_dates_from_series(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        $series = $this->series($controller);

        $record = $this->record($controller, $series['id'], '2024-03-15');

        $this->assertSame('REC-00001', $record['code']);
        $this->assertSame('active', $record['status']);
        $this->assertSame('2026-03-15', substr($record['active_until'], 0, 10));
        $this->assertSame('2029-03-15', substr($record['inactive_until'], 0, 10));
    }

    public function test_changing_series_retention_recomputes_open_records_only(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('compliance_admin');
        $series = $this->series($admin, ['retention_active_years' => 1, 'retention_inactive_years' => 1]);
        $open = $this->record($admin, $series['id'], now()->subYear()->toDateString());
        $old = $this->record($admin, $series['id'], now()->subYears(5)->toDateString());
        $this->actingAs($admin)->postJson("/api/records/{$old['id']}/action", ['action' => 'dispose', 'disposal_reference' => 'BA-01/2026'])->assertOk();

        $this->actingAs($admin)->patchJson("/api/record-series/{$series['id']}", ['retention_inactive_years' => 10])->assertOk();

        $this->assertSame(now()->subYear()->addYears(11)->toDateString(), Record::find($open['id'])->inactive_until->toDateString());
        $this->assertSame(now()->subYears(5)->addYears(2)->toDateString(), Record::find($old['id'])->inactive_until->toDateString());
    }

    public function test_cannot_dispose_before_retention_elapses(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('compliance_admin');
        $series = $this->series($admin);
        $record = $this->record($admin, $series['id'], now()->subYear()->toDateString());

        $this->actingAs($admin)->postJson("/api/records/{$record['id']}/action", ['action' => 'dispose', 'disposal_reference' => 'BA-01'])
            ->assertStatus(422);
    }

    public function test_dispose_requires_dispose_permission_not_just_manage(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller'); // records.manage tanpa records.dispose
        $series = $this->series($controller, ['retention_active_years' => 1, 'retention_inactive_years' => 1]);
        $record = $this->record($controller, $series['id'], now()->subYears(3)->toDateString());

        $this->actingAs($controller)->postJson("/api/records/{$record['id']}/action", ['action' => 'dispose', 'disposal_reference' => 'BA-01'])
            ->assertStatus(403);
    }

    public function test_dispose_after_retention_keeps_record_as_destroyed_with_reference(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('compliance_admin');
        $series = $this->series($admin, ['retention_active_years' => 1, 'retention_inactive_years' => 1]);
        $record = $this->record($admin, $series['id'], now()->subYears(3)->toDateString());

        $this->actingAs($admin)->postJson("/api/records/{$record['id']}/action", ['action' => 'dispose'])->assertStatus(422); // tanpa BA

        $response = $this->actingAs($admin)->postJson("/api/records/{$record['id']}/action", [
            'action' => 'dispose', 'disposal_reference' => 'BA-PEMUSNAHAN-003/IX/2026',
        ]);

        $response->assertOk();
        $this->assertSame('destroyed', $response->json('status'));
        $this->assertSame('BA-PEMUSNAHAN-003/IX/2026', $response->json('disposal_reference'));
        $this->assertSame($admin->id, $response->json('disposed_by'));
        $this->assertDatabaseCount('records', 1);

        $this->actingAs($admin)->patchJson("/api/records/{$record['id']}", ['title' => 'Ubah'])->assertStatus(422);
    }

    public function test_legal_hold_blocks_disposal_until_released(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('compliance_admin');
        $series = $this->series($admin, ['retention_active_years' => 0, 'retention_inactive_years' => 1]);
        $record = $this->record($admin, $series['id'], now()->subYears(2)->toDateString());

        $this->actingAs($admin)->postJson("/api/records/{$record['id']}/action", ['action' => 'hold'])->assertStatus(422); // alasan wajib
        $this->actingAs($admin)->postJson("/api/records/{$record['id']}/action", ['action' => 'hold', 'reason' => 'Sengketa ketenagakerjaan No. 12/2026'])->assertOk();
        $this->actingAs($admin)->postJson("/api/records/{$record['id']}/action", ['action' => 'dispose', 'disposal_reference' => 'BA-01'])->assertStatus(422);

        $this->actingAs($admin)->postJson("/api/records/{$record['id']}/action", ['action' => 'release'])->assertOk();
        $this->actingAs($admin)->postJson("/api/records/{$record['id']}/action", ['action' => 'dispose', 'disposal_reference' => 'BA-01'])->assertOk();
    }

    public function test_disposition_must_match_jra(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('compliance_admin');
        $permanent = $this->series($admin, ['code' => 'REK-AKTA', 'name' => 'Akta & Izin', 'retention_active_years' => 0, 'retention_inactive_years' => 1, 'disposition' => 'permanent']);
        $destroy = $this->series($admin, ['code' => 'REK-TMP', 'name' => 'Rekaman Harian', 'retention_active_years' => 0, 'retention_inactive_years' => 1, 'disposition' => 'destroy']);
        $a = $this->record($admin, $permanent['id'], now()->subYears(2)->toDateString());
        $b = $this->record($admin, $destroy['id'], now()->subYears(2)->toDateString());

        $this->actingAs($admin)->postJson("/api/records/{$a['id']}/action", ['action' => 'dispose', 'disposal_reference' => 'BA'])->assertStatus(422);
        $this->actingAs($admin)->postJson("/api/records/{$b['id']}/action", ['action' => 'archive_permanent', 'disposal_reference' => 'BA'])->assertStatus(422);
        $this->actingAs($admin)->postJson("/api/records/{$a['id']}/action", ['action' => 'archive_permanent', 'disposal_reference' => 'BA-SERAH-01'])
            ->assertOk()->assertJsonPath('status', 'archived_permanent');
    }

    public function test_due_worklists_and_stats(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('compliance_admin');
        $series = $this->series($admin, ['retention_active_years' => 1, 'retention_inactive_years' => 2]);
        $this->record($admin, $series['id'], now()->subMonths(6)->toDateString(), ['title' => 'Baru']); // belum jatuh tempo apa pun
        $this->record($admin, $series['id'], now()->subYears(2)->toDateString(), ['title' => 'Lewat aktif']); // due to_inactive
        $held = $this->record($admin, $series['id'], now()->subYears(4)->toDateString(), ['title' => 'Lewat semua, ditahan']);
        $this->record($admin, $series['id'], now()->subYears(5)->toDateString(), ['title' => 'Siap musnah']);
        $this->actingAs($admin)->postJson("/api/records/{$held['id']}/action", ['action' => 'hold', 'reason' => 'Audit pajak']);

        $response = $this->actingAs($admin)->getJson('/api/records');
        $this->assertSame(4, $response->json('stats.active'));
        $this->assertSame(3, $response->json('stats.due_to_inactive'));
        $this->assertSame(1, $response->json('stats.due_to_dispose'));
        $this->assertSame(1, $response->json('stats.on_hold'));

        $dispose = $this->actingAs($admin)->getJson('/api/records?due=to_dispose')->json('records');
        $this->assertCount(1, $dispose);
        $this->assertSame('Siap musnah', $dispose[0]['title']);
    }

    public function test_future_record_date_and_inactive_series_are_rejected(): void
    {
        $this->activateLicense();
        $admin = $this->makeUser('compliance_admin');
        $series = $this->series($admin);

        $this->actingAs($admin)->postJson('/api/records', [
            'series_id' => $series['id'], 'title' => 'X', 'record_date' => now()->addDay()->toDateString(), 'medium' => 'physical',
        ])->assertStatus(422);

        $this->actingAs($admin)->patchJson("/api/record-series/{$series['id']}", ['active' => false])->assertOk();
        $this->actingAs($admin)->postJson('/api/records', [
            'series_id' => $series['id'], 'title' => 'X', 'record_date' => now()->toDateString(), 'medium' => 'physical',
        ])->assertStatus(422);
    }
}
