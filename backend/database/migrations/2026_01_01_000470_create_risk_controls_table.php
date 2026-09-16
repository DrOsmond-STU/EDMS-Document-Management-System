<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Kontrol aktif yang sudah berjalan untuk memitigasi suatu risiko —
// daftar tumbuh (append), tidak ada status aktif/nonaktif per baris:
// kontrol yang sudah tidak relevan cukup disebut di deskripsi kontrol
// pengganti berikutnya, bukan dihapus (jejak evaluasi risiko tetap utuh).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risk_controls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('risk_id')->constrained()->cascadeOnDelete();
            $table->text('description');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('risk_controls');
    }
};
