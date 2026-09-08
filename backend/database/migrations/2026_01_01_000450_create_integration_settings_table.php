<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Konfigurasi integrasi eksternal (Integration & API): SMTP, AD/LDAP,
// DocuSign, Google Drive. Satu baris per jenis — kredensial sensitif
// (password/client_secret) disimpan di kolom `secrets` yang dienkripsi
// lewat APP_KEY (lihat App\Models\IntegrationSetting), TIDAK PERNAH
// dikirim mentah ke frontend setelah tersimpan.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('integration_settings', function (Blueprint $table) {
            $table->id();
            $table->string('type', 32)->unique(); // smtp|ldap|docusign|google_drive
            $table->json('config')->nullable();
            $table->text('secrets')->nullable(); // encrypted:array
            $table->boolean('enabled')->default(false);
            $table->string('status', 16)->default('not_tested'); // not_tested|connected|failed
            $table->timestamp('last_tested_at')->nullable();
            $table->text('last_test_message')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('integration_settings');
    }
};
