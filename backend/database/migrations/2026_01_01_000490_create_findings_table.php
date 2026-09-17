<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Register Temuan & CAPA — ketidaksesuaian (NC Major/Minor), OFI, observasi,
// dan strength dari audit internal/eksternal maupun sumber lain (walkthrough,
// komplain pelanggan, dst). audit_reference SENGAJA teks bebas, bukan foreign
// key ke modul Audit Internal/Eksternal — modul itu belum dibangun di v2, dan
// tidak semua temuan berasal dari audit terjadwal formal.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('findings', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();

            $table->string('type', 16); // nc_major/nc_minor/ofi/observation/strength
            $table->string('status', 24)->default('open'); // open/root_cause_analysis/capa_in_progress/verification/closed/rejected

            $table->string('audit_source', 16); // internal/external/other
            $table->string('audit_reference')->nullable();
            $table->string('clause_reference')->nullable();

            $table->string('title');
            $table->text('description')->nullable();
            $table->text('evidence')->nullable();

            $table->string('function_id', 32)->nullable();
            $table->string('owner')->nullable(); // penanggung jawab tindak lanjut
            $table->string('raised_by')->nullable(); // pengangkat temuan — teks bebas (bisa auditor eksternal)
            $table->date('due_date')->nullable();

            $table->text('root_cause')->nullable();
            $table->text('rejection_reason')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->foreign('function_id')
                ->references('id')->on('org_functions')
                ->cascadeOnUpdate()
                ->nullOnDelete();

            $table->index('type');
            $table->index('status');
            $table->index('audit_source');
            $table->index('due_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('findings');
    }
};
