<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Program Audit Internal & Eksternal — satu tabel, dibedakan lewat kolom
// `type`, karena keduanya berbagi struktur (rencana, tim, pelaksanaan,
// kesimpulan) dan hanya berbeda siapa yang melaksanakan. Dipisah jadi dua
// menu di sidebar (Audit Internal / Audit Eksternal) di sisi frontend saja.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audits', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('type', 16); // internal/external

            $table->string('title');
            $table->text('objective')->nullable();
            $table->text('scope')->nullable();

            $table->string('function_id', 32)->nullable(); // fungsi/departemen yang diaudit (auditee)
            $table->foreignId('lead_auditor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('audit_team')->nullable(); // nama anggota tim, teks bebas (auditor eksternal belum tentu punya akun)

            $table->date('planned_start')->nullable();
            $table->date('planned_end')->nullable();
            $table->date('actual_start')->nullable();
            $table->date('actual_end')->nullable();

            $table->string('status', 16)->default('planned'); // planned/in_progress/completed/cancelled
            $table->text('summary')->nullable(); // kesimpulan audit

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign('function_id')
                ->references('id')->on('org_functions')
                ->cascadeOnUpdate()
                ->nullOnDelete();

            $table->index('type');
            $table->index('status');
        });

        Schema::create('audit_standard', function (Blueprint $table) {
            $table->foreignId('audit_id')->constrained('audits')->cascadeOnDelete();
            $table->string('standard_code', 32);
            $table->foreign('standard_code')->references('code')->on('standards')->cascadeOnUpdate()->cascadeOnDelete();
            $table->primary(['audit_id', 'standard_code']);
        });

        Schema::table('findings', function (Blueprint $table) {
            $table->foreignId('audit_id')->nullable()->after('audit_reference')->constrained('audits')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('findings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('audit_id');
        });
        Schema::dropIfExists('audit_standard');
        Schema::dropIfExists('audits');
    }
};
