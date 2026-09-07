<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->string('legacy_id', 64)->nullable()->unique();

            // Nomor dokumen resmi, mis. SOP-QA-001. Unik seumur hidup sistem:
            // dokumen obsolete pun nomornya tidak boleh dipakai ulang.
            $table->string('code', 64)->unique();

            $table->string('title');
            $table->string('type', 32);            // Kebijakan/Manual/SOP/Work Instruction/Formulir
            $table->string('function_id', 32);
            $table->string('classification', 32);  // public..top_secret
            $table->string('status', 32);          // draft/review/approval/released/obsolete
            $table->string('validity', 32);        // berlaku/kadaluarsa/tidak_berlaku/belum_berlaku

            $table->string('version', 16)->default('1.0');
            $table->unsignedInteger('revision_number')->default(0);

            $table->date('effective_date')->nullable();
            $table->date('review_date')->nullable();
            $table->date('expiry_date')->nullable();

            $table->json('keywords')->nullable();

            // Isi ringkas/abstrak dokumen. Berkas aslinya (PDF/DOCX) ada di
            // tabel document_files — kolom ini bukan pengganti berkas.
            $table->longText('content')->nullable();

            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->foreign('function_id')
                ->references('id')->on('org_functions')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            // Indeks untuk pertanyaan yang nyata dipakai: papan approval
            // (status), register per fungsi, dan pengingat kedaluwarsa.
            $table->index('status');
            $table->index(['function_id', 'status']);
            $table->index('type');
            $table->index('expiry_date');
            $table->index('review_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
