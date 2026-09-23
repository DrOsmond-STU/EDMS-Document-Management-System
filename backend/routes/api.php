<?php

use App\Http\Controllers\Api\AiAssistantController;
use App\Http\Controllers\Api\ApprovalBoardController;
use App\Http\Controllers\Api\AuditController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CompanySettingController;
use App\Http\Controllers\Api\ComplianceMatrixController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DocumentCommentController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\DocumentFileController;
use App\Http\Controllers\Api\DocumentFolderController;
use App\Http\Controllers\Api\DraftingProjectController;
use App\Http\Controllers\Api\FindingController;
use App\Http\Controllers\Api\IntegrationSettingController;
use App\Http\Controllers\Api\KnowledgeController;
use App\Http\Controllers\Api\LegalRequirementController;
use App\Http\Controllers\Api\LicenseController;
use App\Http\Controllers\Api\MasterDataController;
use App\Http\Controllers\Api\MgmtReviewController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\NumberingSettingController;
use App\Http\Controllers\Api\RecordController;
use App\Http\Controllers\Api\RecordSeriesController;
use App\Http\Controllers\Api\ReportingController;
use App\Http\Controllers\Api\RiskController;
use App\Http\Controllers\Api\SystemAdminController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// Publik, dan dikecualikan dari gerbang lisensi (lihat EnsureLicenseActive,
// didaftarkan global di bootstrap/app.php) — status perlu bisa dibaca kapan
// pun untuk layar blokir, dan apply harus tetap bisa dipanggil tool vendor
// bahkan saat lisensi sedang tidak aktif, karena itulah cara memperbaikinya.
Route::get('license-status', [LicenseController::class, 'status']);
Route::post('license/apply', [LicenseController::class, 'apply'])->middleware('throttle:10,1');

// Memancing cookie XSRF-TOKEN sebelum frontend mengirim permintaan tulis.
Route::get('csrf-cookie', fn () => response()->noContent());

Route::post('auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:10,1');

// Publik (tanpa sesi) — nama & logo perusahaan wajib tampil di halaman
// login sebelum siapa pun masuk.
Route::get('company-settings', [CompanySettingController::class, 'show']);
Route::get('company-settings/logo', [CompanySettingController::class, 'logo'])->name('company-settings.logo');
Route::get('company-settings/sidebar-logo', [CompanySettingController::class, 'sidebarLogo'])->name('company-settings.sidebar-logo');

Route::middleware(['auth', 'account.active'])->group(function () {
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
        Route::delete('master-data/org-functions/{orgFunction}', [MasterDataController::class, 'destroyFunction']);
        Route::get('master-data/standards', [MasterDataController::class, 'standards']);
        Route::post('master-data/standards', [MasterDataController::class, 'storeStandard']);
        Route::patch('master-data/standards/{standard}', [MasterDataController::class, 'updateStandard']);
        Route::delete('master-data/standards/{standard}', [MasterDataController::class, 'destroyStandard']);
        Route::get('master-data/standards/{standard}/clauses', [MasterDataController::class, 'clauses']);
        Route::post('master-data/standards/{standard}/clauses', [MasterDataController::class, 'storeClause']);
        Route::patch('master-data/standards/{standard}/clauses/{clause}', [MasterDataController::class, 'updateClause']);
        Route::delete('master-data/standards/{standard}/clauses/{clause}', [MasterDataController::class, 'destroyClause']);
        Route::post('company-settings', [CompanySettingController::class, 'update']);

        Route::get('dashboard', [DashboardController::class, 'index']);
        Route::get('search', [KnowledgeController::class, 'search']);
        Route::get('knowledge/overview', [KnowledgeController::class, 'overview']);
        Route::get('documents/{document}/related', [KnowledgeController::class, 'related']);
        Route::get('reporting/kpi', [ReportingController::class, 'index']);
        Route::get('reporting/kpi.csv', [ReportingController::class, 'export']);
        Route::get('compliance-matrix', [ComplianceMatrixController::class, 'index']);
        Route::patch('compliance-matrix/assessments', [ComplianceMatrixController::class, 'upsertAssessment']);

        Route::get('approval-board', [ApprovalBoardController::class, 'index']);

        Route::get('risks', [RiskController::class, 'index']);
        Route::post('risks', [RiskController::class, 'store']);
        Route::patch('risks/{risk}', [RiskController::class, 'update']);
        Route::post('risks/{risk}/controls', [RiskController::class, 'addControl']);
        Route::delete('risks/{risk}', [RiskController::class, 'destroy']);
        Route::patch('risks/{risk}/controls/{control}', [RiskController::class, 'updateControl']);
        Route::delete('risks/{risk}/controls/{control}', [RiskController::class, 'destroyControl']);

        Route::get('record-series', [RecordSeriesController::class, 'index']);
        Route::post('record-series', [RecordSeriesController::class, 'store']);
        Route::patch('record-series/{recordSeries}', [RecordSeriesController::class, 'update']);
        Route::delete('record-series/{recordSeries}', [RecordSeriesController::class, 'destroy']);
        Route::get('records', [RecordController::class, 'index']);
        Route::post('records', [RecordController::class, 'store']);
        Route::patch('records/{record}', [RecordController::class, 'update']);
        Route::delete('records/{record}', [RecordController::class, 'destroy']);
        Route::post('records/{record}/action', [RecordController::class, 'action']);

        Route::get('legal-requirements', [LegalRequirementController::class, 'index']);
        Route::post('legal-requirements', [LegalRequirementController::class, 'store']);
        Route::patch('legal-requirements/{legalRequirement}', [LegalRequirementController::class, 'update']);
        Route::delete('legal-requirements/{legalRequirement}', [LegalRequirementController::class, 'destroy']);
        Route::post('legal-requirements/{legalRequirement}/evaluations', [LegalRequirementController::class, 'evaluate']);

        Route::get('audits', [AuditController::class, 'index']);
        Route::post('audits', [AuditController::class, 'store']);
        Route::patch('audits/{audit}', [AuditController::class, 'update']);
        Route::delete('audits/{audit}', [AuditController::class, 'destroy']);
        Route::post('audits/{audit}/transition', [AuditController::class, 'transition']);
        Route::post('audits/{audit}/sessions', [AuditController::class, 'storeSession']);
        Route::patch('audits/{audit}/sessions/{session}', [AuditController::class, 'updateSession']);
        Route::delete('audits/{audit}/sessions/{session}', [AuditController::class, 'destroySession']);
        Route::post('audits/{audit}/checklist', [AuditController::class, 'storeChecklist']);
        Route::patch('audits/{audit}/checklist/{item}', [AuditController::class, 'updateChecklist']);
        Route::delete('audits/{audit}/checklist/{item}', [AuditController::class, 'destroyChecklist']);
        Route::post('audits/{audit}/checklist/{item}/finding', [AuditController::class, 'raiseFinding']);

        Route::get('mgmt-reviews', [MgmtReviewController::class, 'index']);
        Route::post('mgmt-reviews', [MgmtReviewController::class, 'store']);
        Route::patch('mgmt-reviews/{mgmtReview}', [MgmtReviewController::class, 'update']);
        Route::delete('mgmt-reviews/{mgmtReview}', [MgmtReviewController::class, 'destroy']);
        Route::post('mgmt-reviews/{mgmtReview}/transition', [MgmtReviewController::class, 'transition']);
        Route::post('mgmt-reviews/{mgmtReview}/actions', [MgmtReviewController::class, 'addAction']);
        Route::patch('mgmt-reviews/{mgmtReview}/actions/{action}', [MgmtReviewController::class, 'updateAction']);
        Route::delete('mgmt-reviews/{mgmtReview}/actions/{action}', [MgmtReviewController::class, 'destroyAction']);

        Route::get('findings', [FindingController::class, 'index']);
        Route::post('findings', [FindingController::class, 'store']);
        Route::patch('findings/{finding}', [FindingController::class, 'update']);
        Route::delete('findings/{finding}', [FindingController::class, 'destroy']);
        Route::post('findings/{finding}/root-cause', [FindingController::class, 'addRootCause']);
        Route::post('findings/{finding}/actions', [FindingController::class, 'addAction']);
        Route::patch('findings/{finding}/actions/{action}', [FindingController::class, 'updateAction']);
        Route::delete('findings/{finding}/actions/{action}', [FindingController::class, 'destroyAction']);
        Route::post('findings/{finding}/verifications', [FindingController::class, 'addVerification']);
        Route::post('findings/{finding}/close', [FindingController::class, 'close']);
        Route::post('findings/{finding}/reject', [FindingController::class, 'reject']);

        Route::prefix('drafting-projects')->controller(DraftingProjectController::class)->group(function () {
            Route::get('/', 'index');
            Route::post('/', 'store');
            Route::get('{project}', 'show');
            Route::patch('{project}', 'update');
            Route::delete('{project}', 'destroy');
            Route::post('{project}/assign', 'assign');
            Route::post('{project}/reject', 'reject');
            Route::post('{project}/finalize', 'finalize');
            Route::post('{project}/return', 'returnToDrafter');
            Route::post('{project}/ratify', 'ratify');
            Route::get('{project}/final-file', 'finalFile');
            Route::post('{project}/meetings', 'storeMeeting');
            Route::patch('{project}/meetings/{meeting}', 'updateMeeting');
            Route::delete('{project}/meetings/{meeting}', 'destroyMeeting');
            Route::post('{project}/meetings/{meeting}/minutes-file', 'uploadMinutes');
            Route::get('{project}/meetings/{meeting}/minutes-file', 'minutesFile');
            Route::post('{project}/meetings/{meeting}/photos', 'uploadPhoto');
            Route::get('{project}/meetings/{meeting}/photos/{photo}', 'photo');
            Route::delete('{project}/meetings/{meeting}/photos/{photo}', 'destroyPhoto');
            Route::post('{project}/meetings/{meeting}/attendees', 'storeAttendee');
            Route::patch('{project}/meetings/{meeting}/attendees/{attendee}', 'signAttendee');
            Route::put('{project}/meetings/{meeting}/attendees/{attendee}', 'updateAttendee');
            Route::delete('{project}/meetings/{meeting}/attendees/{attendee}', 'destroyAttendee');
            Route::get('{project}/meetings/{meeting}/attendees/{attendee}/signature', 'signature');
        });

        Route::get('documents/{document}/comments', [DocumentCommentController::class, 'index']);
        Route::post('documents/{document}/comments', [DocumentCommentController::class, 'store']);
        Route::patch('comments/{comment}', [DocumentCommentController::class, 'update']);
        Route::delete('comments/{comment}', [DocumentCommentController::class, 'destroy']);
        Route::post('comments/{comment}/resolve', [DocumentCommentController::class, 'resolve']);
        Route::get('discussions', [DocumentCommentController::class, 'inbox']);

        Route::get('notifications', [NotificationController::class, 'index']);
        Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
        Route::post('notifications/{notification}/read', [NotificationController::class, 'read']);

        Route::get('folders', [DocumentFolderController::class, 'index']);
        Route::post('folders', [DocumentFolderController::class, 'store']);
        Route::patch('folders/{folder}', [DocumentFolderController::class, 'update']);
        Route::delete('folders/{folder}', [DocumentFolderController::class, 'destroy']);
        Route::get('folders/{folder}/documents', [DocumentFolderController::class, 'documents']);
        Route::post('folders/{folder}/documents', [DocumentFolderController::class, 'addDocuments']);
        Route::delete('folders/{folder}/documents/{document}', [DocumentFolderController::class, 'removeDocument']);
        Route::post('document-categories', [DocumentFolderController::class, 'storeCategory']);
        Route::patch('document-categories/{category}', [DocumentFolderController::class, 'updateCategory']);
        Route::delete('document-categories/{category}', [DocumentFolderController::class, 'destroyCategory']);
        Route::get('document-categories/{category}/documents', [DocumentFolderController::class, 'categoryDocuments']);
        Route::put('documents/{document}/categories', [DocumentFolderController::class, 'syncDocumentCategories']);

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
        Route::delete('users/{user}', [UserController::class, 'destroy']);

        Route::get('system/info', [SystemAdminController::class, 'index']);
        Route::post('system/cache-clear', [SystemAdminController::class, 'clearCache']);

        Route::get('ai/status', [AiAssistantController::class, 'status']);
        Route::get('ai/generations/{generation}', [AiAssistantController::class, 'show']);
        Route::delete('ai/generations/{generation}', [AiAssistantController::class, 'destroy']);
        Route::post('ai/discover', [AiAssistantController::class, 'discover']);
        Route::post('ai/draft', [AiAssistantController::class, 'draft']);

        Route::get('integrations', [IntegrationSettingController::class, 'index']);
        Route::patch('integrations/{type}', [IntegrationSettingController::class, 'update']);
        Route::post('integrations/{type}/test', [IntegrationSettingController::class, 'test']);
    });
});
