<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Comment & Discussion — diskusi per dokumen: utas (komentar utama +
// balasan satu tingkat), bisa ditandai per bagian dokumen, @mention
// pengguna, dan ditandai selesai (resolved). Komentar dihapus secara soft
// delete supaya utas balasan tetap utuh dan jejaknya tidak hilang.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('documents')->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('document_comments')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users');
            $table->string('section', 120)->nullable(); // bagian dokumen yang dibahas, mis. "Bab 4.2"
            $table->text('body');
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('edited_at')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['document_id', 'parent_id']);
            $table->index('resolved_at');
        });

        Schema::create('document_comment_mentions', function (Blueprint $table) {
            $table->foreignId('comment_id')->constrained('document_comments')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->primary(['comment_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_comment_mentions');
        Schema::dropIfExists('document_comments');
    }
};
