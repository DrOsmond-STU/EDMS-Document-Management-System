<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Folder Virtual & Kategori — cara mengelompokkan dokumen di luar struktur
// resminya (jenis/fungsi/nomor). "Virtual": satu dokumen boleh berada di
// banyak folder sekaligus, dan memindah/menghapus folder tidak pernah
// menyentuh dokumennya. Kategori adalah label datar berwarna.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_folders', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('parent_id')->nullable()->constrained('document_folders')->cascadeOnDelete();
            $table->string('description')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('document_folder_items', function (Blueprint $table) {
            $table->foreignId('folder_id')->constrained('document_folders')->cascadeOnDelete();
            $table->foreignId('document_id')->constrained('documents')->cascadeOnDelete();
            $table->foreignId('added_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->primary(['folder_id', 'document_id']);
        });

        Schema::create('document_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('color', 7)->default('#2f5aa3');
            $table->timestamps();
        });

        Schema::create('document_category', function (Blueprint $table) {
            $table->foreignId('document_id')->constrained('documents')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('document_categories')->cascadeOnDelete();
            $table->primary(['document_id', 'category_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_category');
        Schema::dropIfExists('document_categories');
        Schema::dropIfExists('document_folder_items');
        Schema::dropIfExists('document_folders');
    }
};
