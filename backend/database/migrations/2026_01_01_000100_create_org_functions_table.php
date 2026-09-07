<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Fungsi/Departemen. Memakai kode pendek sebagai primary key ('qa', 'hsse')
// karena kode itu ikut membentuk nomor dokumen (SOP-QA-001) sehingga harus
// stabil dan bermakna, bukan angka auto-increment.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('org_functions', function (Blueprint $table) {
            $table->string('id', 32)->primary();
            $table->string('name');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('org_functions');
    }
};
