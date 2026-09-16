<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Standar acuan yang relevan terhadap suatu risiko (mis. risiko K3
// ditandai ISO45001) — dipakai murni untuk konteks tampilan (chip di
// baris Register Risiko), bukan bagian dari Compliance Matrix.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risk_standard', function (Blueprint $table) {
            $table->foreignId('risk_id')->constrained()->cascadeOnDelete();
            $table->string('standard_code', 32);

            $table->foreign('standard_code')
                ->references('code')->on('standards')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();

            $table->primary(['risk_id', 'standard_code']);
            $table->index('standard_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('risk_standard');
    }
};
