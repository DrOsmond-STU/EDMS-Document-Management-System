<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tabel baris tunggal (selalu id=1) untuk identitas perusahaan yang tampil
// di seluruh aplikasi: nama dan logo. Logo diunggah manual lewat Pengaturan
// Perusahaan — tidak lagi dibuat ulang sebagai SVG oleh siapa pun yang
// mengelola kode, karena logo asli perusahaan adalah aset perusahaan,
// bukan sesuatu yang boleh didekati/ditebak dari deskripsi.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_settings', function (Blueprint $table) {
            $table->id();
            $table->string('name')->default('DoGO');
            $table->string('logo_original_name')->nullable();
            $table->string('logo_stored_path')->nullable();
            $table->string('logo_mime_type', 128)->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_settings');
    }
};
