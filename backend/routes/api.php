<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\DocumentFileController;
use Illuminate\Support\Facades\Route;

// Memancing cookie XSRF-TOKEN sebelum frontend mengirim permintaan tulis.
Route::get('csrf-cookie', fn () => response()->noContent());

Route::post('auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:10,1');

Route::middleware('auth')->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me', [AuthController::class, 'me']);

    // Ganti password sengaja TIDAK memakai middleware password.changed,
    // karena justru inilah satu-satunya jalan keluar bagi akun yang masih
    // memakai password bawaan.
    Route::post('auth/change-password', [AuthController::class, 'changePassword'])
        ->middleware('throttle:10,1');

    Route::middleware('password.changed')->group(function () {
        Route::get('documents', [DocumentController::class, 'index']);
        Route::post('documents', [DocumentController::class, 'store']);
        Route::get('documents/{document}', [DocumentController::class, 'show']);
        Route::patch('documents/{document}', [DocumentController::class, 'update']);
        Route::post('documents/{document}/transition', [DocumentController::class, 'transition']);

        Route::post('documents/{document}/files', [DocumentFileController::class, 'store']);
        Route::get('documents/{document}/files/{file}/download', [DocumentFileController::class, 'download']);
        Route::get('documents/{document}/files/{file}/verify', [DocumentFileController::class, 'verify']);
        Route::delete('documents/{document}/files/{file}', [DocumentFileController::class, 'destroy']);
    });
});
