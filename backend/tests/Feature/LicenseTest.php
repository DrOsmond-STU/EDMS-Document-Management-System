<?php

namespace Tests\Feature;

use App\Models\CompanySetting;
use App\Models\License;
use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LicenseTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_is_blocked_when_no_license_exists(): void
    {
        $this->getJson('/api/documents')->assertStatus(402);
        $this->postJson('/api/auth/login', ['email' => 'x@example.com', 'password' => 'whatever'])
            ->assertStatus(402);
    }

    public function test_license_status_and_apply_are_always_reachable(): void
    {
        $this->getJson('/api/license-status')->assertOk()->assertJson(['valid' => false]);

        $this->postJson('/api/license/apply', [
            'license_key' => 'BAD',
            'expires_at' => now()->addYear()->toDateString(),
            'status' => 'active',
            'company_name' => 'PT Contoh',
            'company_address' => 'Jakarta',
            'signature' => 'not-a-real-signature',
        ])->assertStatus(403);
    }

    public function test_apply_with_correct_signature_unblocks_the_app_and_sets_company_identity(): void
    {
        $service = app(LicenseService::class);
        $expires = now()->addYear()->toDateString();
        $signature = $service->computeSignature('EDMS-TEST-0001', $expires, 'active', 'PT Contoh Jaya', 'Jl. Contoh No. 1');

        $this->postJson('/api/license/apply', [
            'license_key' => 'EDMS-TEST-0001',
            'expires_at' => $expires,
            'status' => 'active',
            'company_name' => 'PT Contoh Jaya',
            'company_address' => 'Jl. Contoh No. 1',
            'signature' => $signature,
        ])->assertOk()->assertJson(['valid' => true]);

        $this->assertSame('PT Contoh Jaya', CompanySetting::current()->name);
        $this->assertSame('Jl. Contoh No. 1', CompanySetting::current()->address);

        // Sekarang lolos gerbang lisensi — gagal berikutnya (401) berasal
        // dari auth, bukan lagi dari license.active (402).
        $this->getJson('/api/documents')->assertStatus(401);
    }

    public function test_directly_edited_expiry_is_rejected_despite_stale_signature(): void
    {
        $service = app(LicenseService::class);
        $expires = now()->addYear()->toDateString();
        $signature = $service->computeSignature('EDMS-TEST-0001', $expires, 'active', 'PT Contoh', '');

        $this->postJson('/api/license/apply', [
            'license_key' => 'EDMS-TEST-0001',
            'expires_at' => $expires,
            'status' => 'active',
            'company_name' => 'PT Contoh',
            'signature' => $signature,
        ])->assertOk();

        // Seseorang mengubah expires_at langsung di database, melewati
        // apply() — tanda tangan lama tidak lagi cocok dengan payload baru.
        $license = License::current();
        $license->expires_at = now()->addYears(10)->toDateString();
        $license->save();

        $this->assertFalse($service->isValid());
        $this->getJson('/api/documents')->assertStatus(402);
    }

    public function test_directly_edited_company_name_invalidates_the_license(): void
    {
        // Skenario inti yang jadi alasan nama/alamat ikut ditandatangani:
        // seluruh kode+database disalin ke server lain lalu nama
        // perusahaannya diganti untuk dijual ulang ke klien berbeda.
        $service = app(LicenseService::class);
        $expires = now()->addYear()->toDateString();
        $signature = $service->computeSignature('EDMS-TEST-0001', $expires, 'active', 'PT Asli', '');

        $this->postJson('/api/license/apply', [
            'license_key' => 'EDMS-TEST-0001',
            'expires_at' => $expires,
            'status' => 'active',
            'company_name' => 'PT Asli',
            'signature' => $signature,
        ])->assertOk()->assertJson(['valid' => true]);

        // Nama perusahaan diubah langsung di database (mis. lewat instance
        // hasil salinan yang company_settings-nya sempat masih bisa ditulis,
        // atau baris database diedit manual) — TANPA lewat apply().
        $setting = CompanySetting::current();
        $setting->name = 'PT Bajakan';
        $setting->save();

        $this->assertFalse($service->isValid());
        $this->getJson('/api/documents')->assertStatus(402);
    }

    public function test_company_settings_update_cannot_change_name_or_address(): void
    {
        // Aktifkan lisensi dulu (gerbang global), lalu buktikan endpoint
        // client-facing yang DULU bisa mengubah nama/alamat sekarang benar-
        // benar mengabaikan kedua field itu — satu-satunya jalur mengubahnya
        // adalah /api/license/apply lewat tool vendor.
        $service = app(LicenseService::class);
        $expires = now()->addYear()->toDateString();
        $signature = $service->computeSignature('EDMS-TEST-0001', $expires, 'active', 'PT Sah', 'Alamat Sah');
        $this->postJson('/api/license/apply', [
            'license_key' => 'EDMS-TEST-0001',
            'expires_at' => $expires,
            'status' => 'active',
            'company_name' => 'PT Sah',
            'company_address' => 'Alamat Sah',
            'signature' => $signature,
        ])->assertOk();

        Role::create(['id' => 'sysadmin', 'label' => 'System Administrator']);
        $user = User::create([
            'name' => 'Admin Uji',
            'email' => 'admin-uji@example.com',
            'password' => 'rahasia-panjang-sekali',
            'active' => true,
            'must_change_password' => false,
        ]);
        $user->roles()->attach('sysadmin');

        $this->actingAs($user)->postJson('/api/company-settings', [
            'name' => 'PT Bajakan',
            'address' => 'Alamat Bajakan',
        ])->assertOk();

        $setting = CompanySetting::current();
        $this->assertSame('PT Sah', $setting->name);
        $this->assertSame('Alamat Sah', $setting->address);
        // Lisensi tetap valid — membuktikan endpoint ini memang tidak pernah
        // menyentuh name/address sama sekali (bukan menyentuh lalu gagal diam-diam).
        $this->assertTrue($service->isValid());
    }

    public function test_expired_license_blocks_the_app(): void
    {
        $service = app(LicenseService::class);
        $expires = now()->subDay()->toDateString();
        $signature = $service->computeSignature('EDMS-TEST-0001', $expires, 'active', 'PT Contoh', '');

        $this->postJson('/api/license/apply', [
            'license_key' => 'EDMS-TEST-0001',
            'expires_at' => $expires,
            'status' => 'active',
            'company_name' => 'PT Contoh',
            'signature' => $signature,
        ])->assertOk()->assertJson(['valid' => false]);

        $this->getJson('/api/documents')->assertStatus(402);
    }
}
