<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tinjauan Manajemen — rapat management review ISO 9001 klausul 9.3.
// Kolom input/output mengikuti struktur klausul 9.3.2 (input) & 9.3.3
// (output) apa adanya, supaya notulen yang diisi otomatis lengkap
// terhadap persyaratan standar, bukan sekadar catatan bebas.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mgmt_reviews', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('title');
            $table->date('meeting_date');
            $table->foreignId('chair_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('attendees')->nullable(); // nama peserta, teks bebas

            $table->string('status', 16)->default('scheduled'); // scheduled/completed/cancelled

            // Input tinjauan (klausul 9.3.2)
            $table->text('previous_actions_status')->nullable(); // status tindak lanjut tinjauan sebelumnya
            $table->text('internal_external_changes')->nullable(); // perubahan isu internal/eksternal relevan
            $table->text('performance_summary')->nullable(); // kepuasan pelanggan, sasaran mutu, kinerja proses, NC/CAPA, audit, penyedia eksternal
            $table->text('resource_adequacy')->nullable(); // kecukupan sumber daya
            $table->text('risk_opportunity_effectiveness')->nullable(); // efektivitas tindakan atas risiko & peluang
            $table->text('improvement_opportunities')->nullable(); // peluang peningkatan

            // Output tinjauan (klausul 9.3.3)
            $table->text('decisions')->nullable(); // keputusan terkait peluang peningkatan
            $table->text('resource_needs')->nullable(); // kebutuhan sumber daya
            $table->text('system_changes')->nullable(); // perubahan yang diperlukan pada SMM

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('status');
            $table->index('meeting_date');
        });

        Schema::create('mgmt_review_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mgmt_review_id')->constrained('mgmt_reviews')->cascadeOnDelete();
            $table->text('description');
            $table->string('pic')->nullable(); // penanggung jawab, teks bebas
            $table->date('due_date')->nullable();
            $table->string('status', 16)->default('open'); // open/in_progress/completed
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mgmt_review_actions');
        Schema::dropIfExists('mgmt_reviews');
    }
};
