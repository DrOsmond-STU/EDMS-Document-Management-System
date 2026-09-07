<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Jejak audit. Sengaja HANYA punya created_at, tanpa updated_at dan tanpa
// soft delete: baris di sini tidak boleh diubah atau dihapus. Ini yang
// membuatnya bisa dipakai sebagai bukti saat audit ISO — berbeda dari
// purwarupa lama yang menyimpan jejak audit di dalam blob JSON yang sama
// dengan datanya, sehingga ikut ditulis ulang setiap aksi.
//
// actor_name & entity_label disimpan sebagai salinan saat kejadian, supaya
// catatan tetap terbaca utuh walau akun atau dokumennya kelak dihapus.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();

            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_name');

            $table->string('action', 64);        // create/status_change/login/export/...
            $table->string('entity', 64);        // Document/User/Finding/...
            $table->string('entity_id', 64)->nullable();
            $table->string('entity_label')->nullable();

            $table->text('detail');

            // Konteks teknis untuk investigasi insiden keamanan.
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();

            $table->timestamp('created_at')->useCurrent();

            $table->index(['entity', 'entity_id']);
            $table->index('actor_id');
            $table->index('created_at');
            $table->index('action');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
