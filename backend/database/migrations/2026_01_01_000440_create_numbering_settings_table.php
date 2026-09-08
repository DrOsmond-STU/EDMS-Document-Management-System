<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Baris tunggal (id=1), seperti company_settings/license — formula
// penomoran dokumen bisa diatur sendiri oleh klien, bukan dikunci di kode.
// format WAJIB diakhiri literal "{seq}" (lihat DocumentNumbering) supaya
// pencarian "kode terakhir dengan awalan yang sama" tetap sederhana dan
// benar di bawah kunci baris bersamaan.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('numbering_settings', function (Blueprint $table) {
            $table->id();
            $table->string('format')->default('{type}-{function}-{seq}');
            $table->unsignedTinyInteger('seq_padding')->default(3);
            // Peta label jenis dokumen -> kode singkat, mis. {"SOP":"SOP","Kebijakan":"KBJ"}.
            $table->json('type_codes')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('numbering_settings');
    }
};
