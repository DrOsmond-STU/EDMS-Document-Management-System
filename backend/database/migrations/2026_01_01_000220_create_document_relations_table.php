<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Keterkaitan antar dokumen: menggantikan, digantikan oleh, merujuk,
// terkait, dan dokumen induk.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_relations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32);
            $table->foreignId('target_document_id')->constrained('documents')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['document_id', 'type', 'target_document_id'], 'doc_rel_unique');
            $table->index('target_document_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_relations');
    }
};
