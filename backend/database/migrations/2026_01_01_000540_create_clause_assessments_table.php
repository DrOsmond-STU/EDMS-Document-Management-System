<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Sel matriks Klausul × Dokumen — status pemenuhan satu klausul terhadap
// satu dokumen tertentu, dinilai manual oleh Compliance Admin (bukan
// dihitung otomatis, karena "dokumen ini memenuhi klausul ini" adalah
// penilaian substansi yang butuh dibaca manusia). Tidak ada baris berarti
// "belum dinilai" — itu sebabnya TIDAK ada status semacam 'unassessed' di
// sini; absennya baris itu sendirilah penandanya.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clause_assessments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clause_id')->constrained('standard_clauses')->cascadeOnDelete();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();

            $table->string('status', 16); // compliant/partial/gap
            $table->text('note')->nullable();

            $table->foreignId('assessed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assessed_at')->nullable();

            $table->timestamps();

            $table->unique(['clause_id', 'document_id']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clause_assessments');
    }
};
