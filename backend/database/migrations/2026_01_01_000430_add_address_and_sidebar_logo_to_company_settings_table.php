<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Alamat perusahaan, dan logo KEDUA yang terpisah dari logo halaman login
// (kolom logo_* yang sudah ada) — logo sidebar biasanya perlu bentuk yang
// lebih ringkas/kotak daripada logo lockup lengkap di halaman login, jadi
// keduanya sengaja dibuat independen (boleh diisi salah satu duluan).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->text('address')->nullable()->after('name');
            $table->string('sidebar_logo_original_name')->nullable()->after('logo_width');
            $table->string('sidebar_logo_stored_path')->nullable()->after('sidebar_logo_original_name');
            $table->string('sidebar_logo_mime_type', 128)->nullable()->after('sidebar_logo_stored_path');
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn(['address', 'sidebar_logo_original_name', 'sidebar_logo_stored_path', 'sidebar_logo_mime_type']);
        });
    }
};
