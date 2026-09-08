<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Lebar tampilan logo (piksel) di halaman login, diatur manual lewat
// Pengaturan Perusahaan. Terpisah dari logo Sidebar, yang selalu mengikuti
// tinggi baris header (fixed) supaya tata letak navigasi tidak pernah rusak
// walau logo yang diunggah berukuran aneh.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->unsignedSmallInteger('logo_width')->default(160)->after('logo_mime_type');
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn('logo_width');
        });
    }
};
