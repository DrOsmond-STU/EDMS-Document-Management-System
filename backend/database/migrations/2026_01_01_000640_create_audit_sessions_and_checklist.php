<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Isi pelaksanaan audit (ISO 19011 6.3–6.4):
// - audits: jenis audit & lembaga (untuk audit eksternal: sertifikasi,
//   surveilen, resertifikasi, pelanggan, regulator).
// - audit_sessions: jadwal/agenda — kapan, auditee (fungsi/proses), auditor.
// - audit_checklist_items: daftar periksa per klausul + hasil & bukti.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audits', function (Blueprint $table) {
            $table->string('audit_kind', 32)->nullable()->after('type');
            $table->string('external_body')->nullable()->after('audit_kind'); // lembaga sertifikasi / pelanggan / regulator
            $table->string('external_reference')->nullable()->after('external_body'); // no. surat/kontrak/sertifikat
        });

        Schema::create('audit_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audit_id')->constrained('audits')->cascadeOnDelete();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at')->nullable();
            $table->string('topic'); // proses/klausul yang diaudit
            $table->string('function_id', 32)->nullable();
            $table->string('auditee')->nullable(); // nama/jabatan auditee
            $table->string('auditor')->nullable();
            $table->string('location')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('function_id')->references('id')->on('org_functions')->cascadeOnUpdate()->nullOnDelete();
            $table->index(['audit_id', 'starts_at']);
        });

        Schema::create('audit_checklist_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audit_id')->constrained('audits')->cascadeOnDelete();
            $table->string('clause_ref', 64)->nullable(); // mis. "ISO9001 7.5"
            $table->text('question');
            $table->string('result', 16)->nullable(); // conform/nc_minor/nc_major/ofi/observation/na
            $table->text('evidence')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->foreignId('finding_id')->nullable()->constrained('findings')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assessed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('assessed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['audit_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_checklist_items');
        Schema::dropIfExists('audit_sessions');
        Schema::table('audits', function (Blueprint $table) {
            $table->dropColumn(['audit_kind', 'external_body', 'external_reference']);
        });
    }
};
