<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tracking Penyusunan Dokumen (PRD §5, 8 tahap): permintaan → undangan
// rapat → rapat multi-sesi (anggaran, foto) → bukti notulen → daftar hadir
// & TTD kanvas → finalisasi → pengesahan → masuk register utama.
//
// Tahap 2–5 berlaku PER RAPAT (bisa berkali-kali); tahap proyek dihitung
// dari data sungguhan (lihat DraftingProject::stages()), bukan dicentang
// manual, supaya stepper tidak bisa "hijau" tanpa bukti.
//
// Berkas (PDF final, bukti notulen, foto) disimpan di disk privat
// `documents` di bawah drafting/{project}, sama seperti berkas dokumen.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drafting_projects', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique(); // REQ-YYYY-NNN
            $table->string('title');
            $table->string('doc_type', 32);
            $table->string('function_id', 32);
            $table->string('classification', 16);
            $table->text('reason'); // alasan kebutuhan
            $table->foreignId('requester_id')->constrained('users');
            $table->foreignId('drafter_id')->nullable()->constrained('users')->nullOnDelete();

            $table->string('status', 16)->default('requested'); // requested/in_progress/finalized/ratified/rejected
            $table->text('rejection_reason')->nullable();
            $table->text('return_note')->nullable(); // catatan pengesah saat mengembalikan finalisasi

            $table->longText('final_content')->nullable();
            $table->string('final_file_path')->nullable();
            $table->string('final_file_name')->nullable();
            $table->unsignedBigInteger('final_file_size')->nullable();
            $table->string('final_file_checksum', 64)->nullable();
            $table->timestamp('finalized_at')->nullable();

            $table->foreignId('ratified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('ratified_at')->nullable();
            $table->foreignId('document_id')->nullable()->constrained('documents')->nullOnDelete();

            $table->timestamps();

            $table->foreign('function_id')->references('id')->on('org_functions')->cascadeOnUpdate();
            $table->index('status');
        });

        Schema::create('drafting_project_standard', function (Blueprint $table) {
            $table->foreignId('drafting_project_id')->constrained('drafting_projects')->cascadeOnDelete();
            $table->string('standard_code', 32);
            $table->foreign('standard_code')->references('code')->on('standards')->cascadeOnUpdate()->cascadeOnDelete();
            $table->primary(['drafting_project_id', 'standard_code']);
        });

        Schema::create('drafting_meetings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('drafting_project_id')->constrained('drafting_projects')->cascadeOnDelete();
            $table->unsignedSmallInteger('session_no');
            $table->string('agenda');
            $table->dateTime('scheduled_at');
            $table->string('location')->nullable();
            $table->dateTime('held_at')->nullable();
            $table->decimal('budget', 15, 2)->nullable(); // anggaran rapat (Rp)
            $table->text('minutes')->nullable(); // ringkasan notulen
            $table->string('minutes_file_path')->nullable(); // bukti notulen (scan/PDF)
            $table->string('minutes_file_name')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['drafting_project_id', 'session_no']);
        });

        Schema::create('drafting_meeting_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('drafting_meeting_id')->constrained('drafting_meetings')->cascadeOnDelete();
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type', 64);
            $table->string('caption')->nullable();
            $table->timestamps();
        });

        Schema::create('drafting_meeting_attendees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('drafting_meeting_id')->constrained('drafting_meetings')->cascadeOnDelete();
            $table->string('name');
            $table->string('position')->nullable(); // jabatan/fungsi
            $table->longText('signature')->nullable(); // PNG data URL dari kanvas
            $table->timestamp('signed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drafting_meeting_attendees');
        Schema::dropIfExists('drafting_meeting_photos');
        Schema::dropIfExists('drafting_meetings');
        Schema::dropIfExists('drafting_project_standard');
        Schema::dropIfExists('drafting_projects');
    }
};
