<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Records Management — ISO 9001 7.5.3 / ISO 15489, mengikuti praktik
// kearsipan Indonesia (UU 43/2009): retensi ditetapkan per SERI rekaman
// dalam Jadwal Retensi Arsip (JRA) — masa aktif, masa inaktif, dan
// keterangan akhir (musnah / permanen / dinilai kembali). Tiap rekaman
// mewarisi JRA seri-nya; tanggal jatuh tempo disimpan (dihitung ulang saat
// JRA diubah) supaya daftar "jatuh tempo retensi" bisa difilter di SQL.
//
// Rekaman TIDAK PERNAH dihapus, termasuk yang dimusnahkan: metadata
// rekaman musnah + nomor berita acara pemusnahan justru bukti bahwa
// pemusnahan dilakukan sesuai JRA.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_series', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('function_id', 32)->nullable(); // unit pengolah/pemilik seri
            $table->unsignedSmallInteger('retention_active_years');
            $table->unsignedSmallInteger('retention_inactive_years');
            $table->string('disposition', 16); // destroy/permanent/review
            $table->string('legal_basis')->nullable(); // dasar hukum/alasan retensi
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->foreign('function_id')->references('id')->on('org_functions')->cascadeOnUpdate()->nullOnDelete();
        });

        Schema::create('records', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->foreignId('series_id')->constrained('record_series');
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('record_date'); // tanggal rekaman dibuat/kegiatan terjadi — titik awal retensi
            $table->string('function_id', 32)->nullable();
            $table->string('medium', 16); // physical/electronic/hybrid
            $table->string('location')->nullable(); // lokasi simpan (lemari/rak/box atau path sistem)
            $table->string('classification', 16)->default('internal'); // public/internal/confidential/secret
            $table->foreignId('document_id')->nullable()->constrained('documents')->nullOnDelete(); // formulir/prosedur asal

            $table->string('status', 24)->default('active'); // active/inactive/destroyed/archived_permanent
            $table->date('active_until');
            $table->date('inactive_until');
            $table->boolean('legal_hold')->default(false);
            $table->string('legal_hold_reason')->nullable();

            $table->date('disposed_at')->nullable();
            $table->string('disposal_reference')->nullable(); // nomor berita acara pemusnahan/penyerahan
            $table->foreignId('disposed_by')->nullable()->constrained('users')->nullOnDelete();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign('function_id')->references('id')->on('org_functions')->cascadeOnUpdate()->nullOnDelete();

            $table->index('status');
            $table->index('active_until');
            $table->index('inactive_until');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('records');
        Schema::dropIfExists('record_series');
    }
};
