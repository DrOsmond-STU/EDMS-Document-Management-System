<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CompanySettingController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\DocumentFileController;
use App\Http\Controllers\Api\LicenseController;
use App\Http\Controllers\Api\MasterDataController;
use Illuminate\Support\Facades\Route;

// Publik, dan dikecualikan dari gerbang lisensi (lihat EnsureLicenseActive,
// didaftarkan global di bootstrap/app.php) — status perlu bisa dibaca kapan
// pun untuk layar blokir, dan apply harus tetap bisa dipanggil tool vendor
// bahkan saat lisensi sedang tidak aktif, karena itulah cara memperbaikinya.
Route::get('license-status', [LicenseController::class, 'status']);
Route::post('license/apply', [LicenseController::class, 'apply']);

// Memancing cookie XSRF-TOKEN sebelum frontend mengirim permintaan tulis.
Route::get('csrf-cookie', fn () => response()->noContent());

Route::post('auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:10,1');

// Publik (tanpa sesi) — nama & logo perusahaan wajib tampil di halaman
// login sebelum siapa pun masuk.
Route::get('company-settings', [CompanySettingController::class, 'show']);
Route::get('company-settings/logo', [CompanySettingController::class, 'logo'])->name('company-settings.logo');
Route::get('company-settings/sidebar-logo', [CompanySettingController::class, 'sidebarLogo'])->name('company-settings.sidebar-logo');

Route::middleware('auth')->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me', [AuthController::class, 'me']);

    // Ganti password sengaja TIDAK memakai middleware password.changed,
    // karena justru inilah satu-satunya jalan keluar bagi akun yang masih
    // memakai password bawaan.
    Route::post('auth/change-password', [AuthController::class, 'changePassword'])
        ->middleware('throttle:10,1');

    Route::middleware('password.changed')->group(function () {
        Route::get('master-data', [MasterDataController::class, 'index']);
        Route::post('company-settings', [CompanySettingController::class, 'update']);

        Route::get('documents', [DocumentController::class, 'index']);
        Route::post('documents', [DocumentController::class, 'store']);
        Route::get('documents/{document}', [DocumentController::class, 'show']);
        Route::patch('documents/{document}', [DocumentController::class, 'update']);
        Route::post('documents/{document}/transition', [DocumentController::class, 'transition']);

        Route::post('documents/{document}/files', [DocumentFileController::class, 'store']);
        Route::get('documents/{document}/files/{file}/download', [DocumentFileController::class, 'download']);
        Route::get('documents/{document}/files/{file}/verify', [DocumentFileController::class, 'verify']);
        Route::delete('documents/{document}/files/{file}', [DocumentFileController::class, 'destroy']);

        Route::get('audit-logs', [AuditLogController::class, 'index']);
        Route::get('audit-logs/meta', [AuditLogController::class, 'meta']);
    });
});
