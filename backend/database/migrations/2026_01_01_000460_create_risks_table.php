<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Register Risiko — manajemen risiko berbasis ISO 31000 & ISO 9001 klausul
// 6.1. Level (low/moderate/high/extreme) DIHITUNG dari likelihood × impact
// (lihat App\Services\RiskScoring) tapi tetap DISIMPAN di sini, bukan
// dihitung ulang tiap baca — supaya perubahan skala skor di masa depan
// tidak diam-diam mengubah level risiko yang sudah dinilai di masa lalu.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risks', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();

            $table->string('title');
            $table->text('description')->nullable();
            $table->string('category', 32); // strategic/operational/compliance/financial/safety/security/environmental/reputational

            $table->string('function_id', 32)->nullable();
            $table->string('owner')->nullable(); // nama penanggung jawab risiko — teks bebas, bukan user_id (bisa pihak eksternal/jabatan)

            $table->unsignedTinyInteger('inherent_likelihood');
            $table->unsignedTinyInteger('inherent_impact');
            $table->string('inherent_level', 16);

            $table->unsignedTinyInteger('residual_likelihood');
            $table->unsignedTinyInteger('residual_impact');
            $table->string('residual_level', 16);

            $table->string('treatment', 16); // avoid/reduce/transfer/accept
            $table->text('treatment_plan')->nullable();

            $table->string('status', 16)->default('identified'); // identified/assessed/treated/monitored/closed

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->foreign('function_id')
                ->references('id')->on('org_functions')
                ->cascadeOnUpdate()
                ->nullOnDelete();

            $table->index('category');
            $table->index('residual_level');
            $table->index('status');
            $table->index(['function_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('risks');
    }
};
