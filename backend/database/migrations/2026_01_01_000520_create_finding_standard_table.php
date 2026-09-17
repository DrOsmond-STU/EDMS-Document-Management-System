<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Standar acuan yang relevan terhadap suatu temuan (mis. NC dari audit
// ISO 45001 ditandai ISO45001) — sama seperti risk_standard/document_standard.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finding_standard', function (Blueprint $table) {
            $table->foreignId('finding_id')->constrained()->cascadeOnDelete();
            $table->string('standard_code', 32);

            $table->foreign('standard_code')
                ->references('code')->on('standards')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();

            $table->primary(['finding_id', 'standard_code']);
            $table->index('standard_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finding_standard');
    }
};
