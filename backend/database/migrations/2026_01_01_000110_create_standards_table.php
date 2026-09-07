<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Standar acuan (ISO9001, ISO45001, SMK3, ...). Kode standar dipakai langsung
// sebagai primary key karena sudah unik secara internasional dan dirujuk
// lintas modul (dokumen, audit, temuan, compliance matrix).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('standards', function (Blueprint $table) {
            $table->string('code', 32)->primary();
            $table->string('name');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('standards');
    }
};
