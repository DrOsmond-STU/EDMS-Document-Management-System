<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sesi yang dibuat sebelum waktu ini tidak berlaku lagi (lihat
 * EnsureAccountActive). Diisi saat password diganti/di-reset supaya sesi
 * lama — termasuk sesi curian — langsung terputus, apa pun driver sesinya.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('sessions_valid_after')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('sessions_valid_after');
        });
    }
};
