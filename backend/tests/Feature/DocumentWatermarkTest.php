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

class DocumentWatermarkTest extends TestCase
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

    private function makeDocumentWithFile(string $status, string $mime = 'application/pdf'): array
    {
        Storage::fake('documents');

        $fn = OrgFunction::firstOrCreate(['id' => 'qa'], ['name' => 'Quality Assurance', 'active' => true]);

        $document = Document::create([
            'code' => 'SOP-QA-'.random_int(100, 999),
            'title' => 'Dokumen Uji', 'type' => 'SOP', 'function_id' => $fn->id,
            'classification' => 'internal', 'status' => $status,
            'validity' => $status === 'released' ? 'berlaku' : 'belum_berlaku',
            'version' => '1.0', 'revision_number' => 0,
        ]);

        if ($mime === 'application/pdf') {
            // Perlu PDF SUNGGUHAN (bukan sekadar teks berawalan %PDF) supaya
            // FPDI bisa mem-parse-nya saat ditempeli watermark.
            $pdf = new \TCPDF();
            $pdf->setPrintHeader(false);
            $pdf->AddPage();
            $pdf->SetFont('helvetica', '', 12);
            $pdf->Write(0, 'Isi dokumen uji.');
            $content = $pdf->Output('', 'S');
        } else {
            $content = 'berkas-office-bukan-pdf';
        }

        $path = "documents/2026/{$document->id}/test.".($mime === 'application/pdf' ? 'pdf' : 'bin');
        Storage::disk('documents')->put($path, $content);

        $file = DocumentFile::create([
            'document_id' => $document->id,
            'original_name' => 'test.'.($mime === 'application/pdf' ? 'pdf' : 'bin'),
            'disk' => 'documents',
            'stored_path' => $path,
            'mime_type' => $mime,
            'size_bytes' => strlen($content),
            'checksum_sha256' => hash('sha256', $content),
            'is_primary' => true,
            'uploaded_by_name' => 'Sistem',
        ]);

        return [$document, $file];
    }

    public function test_non_controlled_document_can_be_viewed_without_watermark(): void
    {
        $this->activateLicense();
        $drafter = $this->makeUser('drafter');
        [$document, $file] = $this->makeDocumentWithFile('draft');

        $response = $this->actingAs($drafter)->getJson("/api/documents/{$document->id}/files/{$file->id}/view");

        $response->assertOk();
        $this->assertStringContainsString('inline', $response->headers->get('Content-Disposition'));
    }

    public function test_controlled_document_view_returns_watermarked_pdf(): void
    {
        $this->activateLicense();
        $drafter = $this->makeUser('drafter');
        [$document, $file] = $this->makeDocumentWithFile('released');

        $response = $this->actingAs($drafter)->getJson("/api/documents/{$document->id}/files/{$file->id}/view");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
        $this->assertDatabaseHas('audit_logs', ['action' => 'view', 'entity' => 'DocumentFile']);
    }

    public function test_controlled_document_raw_download_forbidden_without_document_control(): void
    {
        $this->activateLicense();
        $drafter = $this->makeUser('drafter');
        [$document, $file] = $this->makeDocumentWithFile('released');

        $this->actingAs($drafter)
            ->getJson("/api/documents/{$document->id}/files/{$file->id}/download")
            ->assertStatus(403);
    }

    public function test_controller_can_still_download_raw_controlled_document(): void
    {
        $this->activateLicense();
        $controller = $this->makeUser('controller');
        [$document, $file] = $this->makeDocumentWithFile('released');

        $this->actingAs($controller)
            ->getJson("/api/documents/{$document->id}/files/{$file->id}/download")
            ->assertOk();
    }

    public function test_non_controlled_document_download_is_unrestricted(): void
    {
        $this->activateLicense();
        $drafter = $this->makeUser('drafter');
        [$document, $file] = $this->makeDocumentWithFile('draft');

        $this->actingAs($drafter)
            ->getJson("/api/documents/{$document->id}/files/{$file->id}/download")
            ->assertOk();
    }

    public function test_non_watermarkable_mime_returns_415_for_controlled_document(): void
    {
        $this->activateLicense();
        $drafter = $this->makeUser('drafter');
        [$document, $file] = $this->makeDocumentWithFile('released', 'application/msword');

        $this->actingAs($drafter)
            ->getJson("/api/documents/{$document->id}/files/{$file->id}/view")
            ->assertStatus(415);
    }
}
