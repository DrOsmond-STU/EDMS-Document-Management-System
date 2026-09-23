<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Asisten AI — satu baris per permintaan ke layanan AI: siapa, jenis
// (rekomendasi/rancangan), model, pemakaian token (untuk kendali biaya),
// dan apakah hasilnya DITINDAKLANJUTI (jadi permintaan penyusunan atau
// dokumen draft). Kolom tindak lanjut itulah sumber KPI PRD §9 no. 6
// "Adopsi Asisten AI". Hasil lengkap disimpan supaya bisa ditinjau ulang.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_generations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users');
            $table->string('kind', 16); // discover/draft
            $table->string('subject'); // topik atau judul
            $table->string('model', 64);
            $table->unsignedInteger('input_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->json('result')->nullable();
            $table->timestamp('followed_up_at')->nullable();
            $table->string('followed_up_ref')->nullable(); // mis. "REQ-2026-004" atau "SOP-QA-012"
            $table->timestamps();

            $table->index(['kind', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_generations');
    }
};
