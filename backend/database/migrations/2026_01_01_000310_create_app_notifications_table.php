<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Notifikasi dalam aplikasi. Dinamai app_notifications agar tidak bentrok
// dengan tabel notifications bawaan Laravel, yang kelak dipakai untuk
// pengiriman email lewat antrean.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_notifications', function (Blueprint $table) {
            $table->id();
            $table->string('legacy_id', 64)->nullable()->unique();

            // null = pengumuman untuk semua pengguna.
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();

            $table->string('type', 64);
            $table->string('title');
            $table->text('body')->nullable();
            $table->string('link')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_notifications');
    }
};
