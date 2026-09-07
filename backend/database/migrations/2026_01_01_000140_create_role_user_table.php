<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Seorang pengguna boleh memegang lebih dari satu peran (mis. Reviewer +
// Sysadmin), sesuai matriks RBAC yang sudah berjalan di purwarupa.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('role_user', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role_id', 32);
            $table->timestamps();

            $table->foreign('role_id')
                ->references('id')->on('roles')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();

            $table->primary(['user_id', 'role_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_user');
    }
};
