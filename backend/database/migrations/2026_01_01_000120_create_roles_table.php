<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// 11 peran RBAC. Izin per peran TIDAK disimpan di sini — izin adalah aturan
// kode (lihat App\Support\Permissions) supaya tidak bisa diubah lewat data
// dan selalu bisa ditinjau lewat riwayat git.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->string('id', 32)->primary();
            $table->string('label');
            $table->string('summary')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('roles');
    }
};
