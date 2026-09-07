<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Berkas asli dokumen (PDF/DOCX/XLSX). Ini fitur inti EDMS yang belum ada di
// purwarupa. Berkas disimpan di disk privat di luar document root; unduhan
// selalu lewat controller yang memeriksa hak akses, tidak pernah lewat URL
// langsung.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();

            // Berkas menempel pada revisi tertentu, sehingga versi lama tetap
            // bisa diunduh sebagai bukti — syarat pengendalian dokumen ISO.
            $table->foreignId('document_revision_id')->nullable()
                ->constrained('document_revisions')->nullOnDelete();

            $table->string('original_name');
            $table->string('disk', 32)->default('documents');
            $table->string('stored_path');
            $table->string('mime_type', 128);
            $table->unsignedBigInteger('size_bytes');

            // Untuk membuktikan berkas tidak berubah sejak diunggah, dan untuk
            // mendeteksi unggahan ganda yang identik.
            $table->char('checksum_sha256', 64);

            $table->boolean('is_primary')->default(false);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('uploaded_by_name');

            $table->timestamps();
            $table->softDeletes();

            $table->index(['document_id', 'is_primary']);
            $table->index('checksum_sha256');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_files');
    }
};
