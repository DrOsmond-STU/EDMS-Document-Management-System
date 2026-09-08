<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Reminder retensi/tinjauan ulang dokumen — bagian dari Integration & API
// → Email/SMTP. Perintahnya sendiri berhenti diam dengan pesan jelas kalau
// integrasi SMTP belum diaktifkan, jadi aman dijadwalkan selalu.
Schedule::command('documents:send-review-reminders')->dailyAt('07:00');
