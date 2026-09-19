<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Daftar klausul/pasal tiap standar (mis. ISO9001 4.1 "Konteks Organisasi")
// — baris pada Compliance Matrix. Diisi lewat StandardClauseSeeder dengan
// taksonomi klausul ISO yang sudah terverifikasi (bukan dikarang), bukan
// lewat form tambah-klausul manual — nomor & judul klausul suatu standar
// sudah tetap secara definisi, jadi tidak masuk akal pengguna mengetik
// ulang dari nol.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('standard_clauses', function (Blueprint $table) {
            $table->id();
            $table->string('standard_code', 32);
            $table->string('code', 16); // "4.1", "6.1.2", "A.5.9", "I", dst.
            $table->string('title');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('standard_code')
                ->references('code')->on('standards')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();

            $table->unique(['standard_code', 'code']);
            $table->index('sort_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('standard_clauses');
    }
};
