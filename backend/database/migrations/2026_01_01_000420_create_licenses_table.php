<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Baris tunggal (selalu id=1), TERPISAH dari company_settings dengan sengaja:
// company_settings (nama/alamat/logo) boleh diubah sysadmin klien sendiri,
// tapi lisensi HANYA boleh ditulis lewat endpoint /api/license/apply yang
// memverifikasi tanda tangan HMAC dari tool vendor eksternal — tidak ada
// endpoint atau halaman di EDMS yang bisa mengubah tabel ini secara langsung.
// Lihat App\Services\LicenseService.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('licenses', function (Blueprint $table) {
            $table->id();
            $table->string('license_key')->nullable();
            $table->date('expires_at')->nullable();
            $table->string('status', 32)->default('inactive'); // inactive/active/suspended/revoked
            $table->date('activated_at')->nullable();
            // HMAC-SHA256("{license_key}|{expires_at}|{status}", secret vendor).
            // Diverifikasi ulang setiap kali dicek — bukan sekadar disimpan.
            $table->string('signature')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('licenses');
    }
};
