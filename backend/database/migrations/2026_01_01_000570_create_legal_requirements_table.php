<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Legal Register — daftar peraturan perundang-undangan & persyaratan lain
// yang berlaku (ISO 14001/45001 klausul 6.1.3), beserta riwayat evaluasi
// kepatuhan (klausul 9.1.2). Riwayat evaluasi disimpan di tabel terpisah,
// bukan ditimpa di satu kolom, karena standar mewajibkan informasi
// terdokumentasi atas HASIL evaluasi dari waktu ke waktu.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('legal_requirements', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();

            $table->string('title'); // nama/judul peraturan
            $table->string('regulation_number')->nullable(); // mis. "PP No. 22 Tahun 2021"
            $table->string('regulation_type', 32); // uu/pp/perpres/permen/perda/keputusan/sni/lainnya
            $table->string('issuer')->nullable(); // instansi penerbit
            $table->date('issued_date')->nullable();
            $table->string('category', 32); // lingkungan/k3/ketenagakerjaan/mutu/keamanan_informasi/anti_penyuapan/umum

            $table->text('summary')->nullable();
            $table->text('applicable_clauses')->nullable(); // pasal yang relevan bagi organisasi
            $table->text('obligations')->nullable(); // kewajiban konkret yang harus dipenuhi

            $table->string('function_id', 32)->nullable(); // fungsi penanggung jawab pemenuhan
            $table->string('owner')->nullable();

            $table->string('status', 16)->default('active'); // active/revoked/replaced
            $table->string('compliance_status', 16)->default('not_evaluated'); // compliant/partial/non_compliant/not_evaluated
            $table->date('last_evaluated_at')->nullable();
            $table->date('next_evaluation_at')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign('function_id')->references('id')->on('org_functions')->cascadeOnUpdate()->nullOnDelete();

            $table->index('category');
            $table->index('status');
            $table->index('compliance_status');
            $table->index('next_evaluation_at');
        });

        Schema::create('legal_evaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('legal_requirement_id')->constrained('legal_requirements')->cascadeOnDelete();
            $table->string('compliance_status', 16);
            $table->date('evaluation_date');
            $table->text('evidence')->nullable(); // bukti pemenuhan / dasar penilaian
            $table->text('notes')->nullable();
            $table->foreignId('evaluated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legal_evaluations');
        Schema::dropIfExists('legal_requirements');
    }
};
