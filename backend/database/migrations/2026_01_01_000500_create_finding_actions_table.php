<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tindakan Koreksi/Preventif (CAPA) untuk satu temuan — bisa lebih dari satu
// per temuan (mis. satu koreksi langsung + satu preventif jangka panjang).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finding_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('finding_id')->constrained()->cascadeOnDelete();

            $table->string('type', 16); // corrective/preventive
            $table->text('description');
            $table->string('pic'); // person in charge — teks bebas
            $table->date('due_date')->nullable();
            $table->string('status', 16)->default('open'); // open/in_progress/completed

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('finding_actions');
    }
};
