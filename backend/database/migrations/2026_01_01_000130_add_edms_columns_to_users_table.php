<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Jejak id lama dari penyimpanan JSON (app_state) — dipakai saat
            // migrasi data supaya relasi lama bisa dipetakan ulang, dan agar
            // migrasi bisa diulang tanpa menggandakan baris.
            $table->string('legacy_id', 64)->nullable()->unique()->after('id');

            $table->string('function_id', 32)->nullable()->after('email');
            $table->boolean('active')->default(true)->after('function_id');

            // Password bawaan dibagikan ke semua akun saat onboarding, jadi
            // pengguna wajib menggantinya di login pertama sebelum bisa
            // mengakses apa pun.
            $table->boolean('must_change_password')->default(true)->after('active');
            $table->timestamp('password_changed_at')->nullable()->after('must_change_password');

            $table->timestamp('last_login_at')->nullable()->after('password_changed_at');
            $table->unsignedSmallInteger('failed_login_count')->default(0)->after('last_login_at');
            $table->timestamp('locked_until')->nullable()->after('failed_login_count');

            $table->foreign('function_id')
                ->references('id')->on('org_functions')
                ->cascadeOnUpdate()
                ->nullOnDelete();

            $table->index('active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['function_id']);
            $table->dropIndex(['active']);
            $table->dropColumn([
                'legacy_id', 'function_id', 'active', 'must_change_password',
                'password_changed_at', 'last_login_at', 'failed_login_count', 'locked_until',
            ]);
        });
    }
};
