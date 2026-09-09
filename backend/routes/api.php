<?php

use App\Http\Controllers\Api\ApprovalBoardController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CompanySettingController;
use App\Http\Controllers\Api\ComplianceMatrixController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\DocumentFileController;
use App\Http\Controllers\Api\IntegrationSettingController;
use App\Http\Controllers\Api\LicenseController;
use App\Http\Controllers\Api\MasterDataController;
use App\Http\Controllers\Api\NumberingSettingController;
use App\Http\Controllers\Api\UserController;
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
        Route::get('master-data/org-functions', [MasterDataController::class, 'functions']);
        Route::post('master-data/org-functions', [MasterDataController::class, 'storeFunction']);
        Route::patch('master-data/org-functions/{orgFunction}', [MasterDataController::class, 'updateFunction']);
        Route::get('master-data/standards', [MasterDataController::class, 'standards']);
        Route::post('master-data/standards', [MasterDataController::class, 'storeStandard']);
        Route::patch('master-data/standards/{standard}', [MasterDataController::class, 'updateStandard']);
        Route::post('company-settings', [CompanySettingController::class, 'update']);

        Route::get('dashboard', [DashboardController::class, 'index']);
        Route::get('compliance-matrix', [ComplianceMatrixController::class, 'index']);

        Route::get('approval-board', [ApprovalBoardController::class, 'index']);

        Route::get('documents', [DocumentController::class, 'index']);
        Route::post('documents', [DocumentController::class, 'store']);
        Route::get('documents/{document}', [DocumentController::class, 'show']);
        Route::patch('documents/{document}', [DocumentController::class, 'update']);
        Route::delete('documents/{document}', [DocumentController::class, 'destroy']);
        Route::post('documents/{document}/transition', [DocumentController::class, 'transition']);
        Route::post('documents/{document}/lifecycle-action', [DocumentController::class, 'lifecycleAction']);

        Route::post('documents/{document}/files', [DocumentFileController::class, 'store']);
        Route::get('documents/{document}/files/{file}/download', [DocumentFileController::class, 'download']);
        Route::get('documents/{document}/files/{file}/view', [DocumentFileController::class, 'view']);
        Route::get('documents/{document}/files/{file}/verify', [DocumentFileController::class, 'verify']);
        Route::delete('documents/{document}/files/{file}', [DocumentFileController::class, 'destroy']);

        Route::get('numbering-settings', [NumberingSettingController::class, 'show']);
        Route::post('numbering-settings', [NumberingSettingController::class, 'update']);

        Route::get('audit-logs', [AuditLogController::class, 'index']);
        Route::get('audit-logs/meta', [AuditLogController::class, 'meta']);

        Route::get('users', [UserController::class, 'index']);
        Route::get('users/meta', [UserController::class, 'meta']);
        Route::post('users', [UserController::class, 'store']);
        Route::patch('users/{user}', [UserController::class, 'update']);
        Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword']);

        Route::get('integrations', [IntegrationSettingController::class, 'index']);
        Route::patch('integrations/{type}', [IntegrationSettingController::class, 'update']);
        Route::post('integrations/{type}/test', [IntegrationSettingController::class, 'test']);
    });
});
