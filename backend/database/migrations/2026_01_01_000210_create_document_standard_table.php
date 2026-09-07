<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Satu dokumen bisa memenuhi beberapa standar sekaligus (mis. SOP yang
// menutup ISO 9001 dan ISO 45001) — inilah dasar Compliance Matrix.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_standard', function (Blueprint $table) {
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->string('standard_code', 32);

            $table->foreign('standard_code')
                ->references('code')->on('standards')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();

            $table->primary(['document_id', 'standard_code']);
            $table->index('standard_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_standard');
    }
};
