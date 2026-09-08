<?php

namespace Tests\Feature;

use App\Models\License;
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
            'signature' => 'not-a-real-signature',
        ])->assertStatus(403);
    }

    public function test_apply_with_correct_signature_unblocks_the_app(): void
    {
        $service = app(LicenseService::class);
        $expires = now()->addYear()->toDateString();
        $signature = $service->computeSignature('EDMS-TEST-0001', $expires, 'active');

        $this->postJson('/api/license/apply', [
            'license_key' => 'EDMS-TEST-0001',
            'expires_at' => $expires,
            'status' => 'active',
            'signature' => $signature,
        ])->assertOk()->assertJson(['valid' => true]);

        // Sekarang lolos gerbang lisensi — gagal berikutnya (401) berasal
        // dari auth, bukan lagi dari license.active (402).
        $this->getJson('/api/documents')->assertStatus(401);
    }

    public function test_directly_edited_expiry_is_rejected_despite_stale_signature(): void
    {
        $service = app(LicenseService::class);
        $expires = now()->addYear()->toDateString();
        $signature = $service->computeSignature('EDMS-TEST-0001', $expires, 'active');

        $this->postJson('/api/license/apply', [
            'license_key' => 'EDMS-TEST-0001',
            'expires_at' => $expires,
            'status' => 'active',
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

    public function test_expired_license_blocks_the_app(): void
    {
        $service = app(LicenseService::class);
        $expires = now()->subDay()->toDateString();
        $signature = $service->computeSignature('EDMS-TEST-0001', $expires, 'active');

        $this->postJson('/api/license/apply', [
            'license_key' => 'EDMS-TEST-0001',
            'expires_at' => $expires,
            'status' => 'active',
            'signature' => $signature,
        ])->assertOk()->assertJson(['valid' => false]);

        $this->getJson('/api/documents')->assertStatus(402);
    }
}
