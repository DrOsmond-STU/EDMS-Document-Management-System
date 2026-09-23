<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $service = app(LicenseService::class);
        $expires = now()->addYear()->toDateString();
        $this->postJson('/api/license/apply', [
            'license_key' => 'EDMS-TEST-0001', 'expires_at' => $expires, 'status' => 'active', 'company_name' => 'PT Uji',
            'signature' => $service->computeSignature('EDMS-TEST-0001', $expires, 'active', 'PT Uji', ''),
        ])->assertOk();
    }

    private function user(string $email, array $roles = []): User
    {
        $user = User::create(['name' => $email, 'email' => $email, 'password' => 'rahasia-panjang-sekali', 'active' => true, 'must_change_password' => false]);
        foreach ($roles as $r) {
            Role::firstOrCreate(['id' => $r], ['label' => $r]);
            $user->roles()->attach($r);
        }

        return $user;
    }

    public function test_deactivated_account_loses_access_even_with_live_session(): void
    {
        $user = $this->user('staff@example.com', ['viewer']);
        $this->actingAs($user)->getJson('/api/auth/me')->assertOk();

        $user->forceFill(['active' => false])->save();

        $this->actingAs($user->fresh())->getJson('/api/auth/me')->assertUnauthorized();
        $this->actingAs($user->fresh())->getJson('/api/documents')->assertUnauthorized();
    }

    public function test_security_headers_are_sent(): void
    {
        $response = $this->getJson('/api/license-status');
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('X-Frame-Options', 'SAMEORIGIN');
        $response->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

        $page = $this->get('/login');
        $csp = (string) $page->headers->get('Content-Security-Policy');
        $this->assertStringContainsString("script-src 'self'", $csp);
        $this->assertStringContainsString("object-src 'none'", $csp);
        $this->assertStringContainsString("frame-ancestors 'self'", $csp);
    }

    public function test_hostile_file_name_cannot_inject_response_headers(): void
    {
        Storage::fake('documents');
        Storage::disk('documents')->put('documents/x.pdf', '%PDF-1.4 test');
        OrgFunction::create(['id' => 'hse', 'name' => 'HSE', 'active' => true]);
        $controller = $this->user('ctrl@example.com', ['controller']);
        $doc = Document::create(['code' => 'SOP-HSE-001', 'title' => 'D', 'type' => 'SOP', 'function_id' => 'hse', 'classification' => 'internal',
            'status' => 'draft', 'validity' => 'belum_berlaku', 'version' => '0.1', 'revision_number' => 0]);
        $file = DocumentFile::create(['document_id' => $doc->id, 'original_name' => "evil\".pdf\"; x=\"1", 'disk' => 'documents', 'stored_path' => 'documents/x.pdf',
            'mime_type' => 'application/pdf', 'size_bytes' => 13, 'checksum_sha256' => hash('sha256', '%PDF-1.4 test'), 'is_primary' => true, 'uploaded_by_name' => 'x']);

        $response = $this->actingAs($controller)->get("/api/documents/{$doc->id}/files/{$file->id}/view");
        $response->assertOk();
        $disposition = (string) $response->headers->get('Content-Disposition');
        $this->assertStringStartsWith('inline;', $disposition);
        $this->assertStringNotContainsString('x="1', $disposition, 'Kutip dari nama berkas tidak boleh membuka parameter header baru.');
    }

    public function test_login_does_not_reveal_whether_an_email_exists(): void
    {
        $this->user('ada@example.com');
        $unknown = $this->postJson('/api/auth/login', ['email' => 'tidak-ada@example.com', 'password' => 'salah-sekali-123']);
        $wrong = $this->postJson('/api/auth/login', ['email' => 'ada@example.com', 'password' => 'salah-sekali-123']);

        $this->assertSame($unknown->status(), $wrong->status());
        $this->assertSame($unknown->json('message'), $wrong->json('message'));
    }

    public function test_api_is_rate_limited(): void
    {
        $user = $this->user('bot@example.com', ['viewer']);
        $statuses = [];
        for ($i = 0; $i < 605; $i++) {
            $statuses[] = $this->actingAs($user)->getJson('/api/auth/me')->status();
        }
        $this->assertContains(429, $statuses, 'Permintaan beruntun tanpa batas harus dihentikan (429).');
    }
}
