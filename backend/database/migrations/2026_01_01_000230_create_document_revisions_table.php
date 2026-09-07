<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Riwayat revisi dokumen. editor_name disimpan sebagai salinan (bukan hanya
// FK) karena riwayat revisi adalah bukti audit: harus tetap terbaca utuh
// walau akun penyuntingnya kelak dihapus atau berganti nama.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_revisions', function (Blueprint $table) {
            $table->id();
            $table->string('legacy_id', 64)->nullable()->unique();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();

            $table->unsignedInteger('revision_number');
            $table->string('version', 16);
            $table->date('date');

            $table->foreignId('editor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('editor_name');

            $table->text('notes')->nullable();
            $table->string('status', 32);
            $table->longText('content_snapshot')->nullable();

            $table->timestamps();

            $table->unique(['document_id', 'revision_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_revisions');
    }
};
