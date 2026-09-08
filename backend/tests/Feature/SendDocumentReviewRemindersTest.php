<?php

namespace Tests\Feature;

use App\Mail\DocumentReviewReminderMail;
use App\Models\Document;
use App\Models\IntegrationSetting;
use App\Models\OrgFunction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class SendDocumentReviewRemindersTest extends TestCase
{
    use RefreshDatabase;

    private function makeOwner(): User
    {
        return User::create([
            'name' => 'Pemilik Dokumen',
            'email' => 'owner@example.com',
            'password' => 'rahasia-panjang-sekali',
            'active' => true,
            'must_change_password' => false,
        ]);
    }

    private function makeDueDocument(User $owner): Document
    {
        $fn = OrgFunction::firstOrCreate(['id' => 'qa'], ['name' => 'Quality Assurance', 'active' => true]);

        return Document::create([
            'code' => 'SOP-QA-'.random_int(1000, 9999),
            'title' => 'Dokumen Jatuh Tempo', 'type' => 'SOP', 'function_id' => $fn->id,
            'classification' => 'internal', 'status' => 'released', 'validity' => 'berlaku',
            'version' => '1.0', 'revision_number' => 0, 'owner_id' => $owner->id,
            'review_date' => now()->addDays(5)->toDateString(),
        ]);
    }

    public function test_command_skips_sending_when_smtp_integration_not_enabled(): void
    {
        Mail::fake();
        $owner = $this->makeOwner();
        $this->makeDueDocument($owner);

        $this->artisan('documents:send-review-reminders')
            ->expectsOutputToContain('belum aktif')
            ->assertExitCode(0);

        Mail::assertNothingSent();
    }

    public function test_command_sends_reminder_when_smtp_enabled_and_documents_due(): void
    {
        Mail::fake();
        $owner = $this->makeOwner();
        $this->makeDueDocument($owner);

        IntegrationSetting::create([
            'type' => 'smtp',
            'config' => ['host' => 'smtp.example.com', 'port' => 587, 'from_address' => 'edms@example.com'],
            'secrets' => [],
            'enabled' => true,
        ]);

        $this->artisan('documents:send-review-reminders', ['--days' => 30])
            ->assertExitCode(0);

        Mail::assertSent(DocumentReviewReminderMail::class, function ($mail) use ($owner) {
            return $mail->hasTo($owner->email);
        });
    }

    public function test_command_reports_no_documents_due(): void
    {
        Mail::fake();
        IntegrationSetting::create([
            'type' => 'smtp',
            'config' => ['host' => 'smtp.example.com', 'from_address' => 'edms@example.com'],
            'secrets' => [],
            'enabled' => true,
        ]);

        $this->artisan('documents:send-review-reminders')
            ->expectsOutputToContain('Tidak ada dokumen')
            ->assertExitCode(0);

        Mail::assertNothingSent();
    }
}
