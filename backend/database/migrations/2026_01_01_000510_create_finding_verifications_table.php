<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Verifikasi efektivitas tindak lanjut — append-only (bisa lebih dari satu
// kali verifikasi kalau yang pertama belum efektif). Temuan hanya bisa
// ditutup kalau ADA verifikasi dengan effective=true (lihat FindingController).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finding_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('finding_id')->constrained()->cascadeOnDelete();

            $table->string('method', 32); // document_review/interview/observation/sampling
            $table->boolean('effective');
            $table->text('notes')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finding_verifications');
    }
};
