<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Deskripsi peran di Manajemen Pengguna disesuaikan dengan hak akses terkini
 * (mis. Auditor kini merencanakan & melaksanakan audit, bukan sekadar
 * read-only). Hanya kolom summary yang disentuh — tidak menjalankan ulang
 * seeder yang bisa menimpa master data yang sudah diubah administrator.
 */
return new class extends Migration
{
    private const SUMMARIES = [
        'controller' => 'Mengelola register, status, dan records dokumen lintas fungsi',
        'ratifier' => 'Mengesahkan dokumen final, memimpin tinjauan manajemen',
        'function_head' => 'Mengawasi dokumen fungsinya, mengelola risiko dan temuan/CAPA',
        'compliance_admin' => 'Mengelola compliance matrix, risiko, legal register, audit, temuan, dan records',
        'auditor' => 'Merencanakan dan melaksanakan audit, mencatat temuan, melihat audit trail',
    ];

    public function up(): void
    {
        foreach (self::SUMMARIES as $id => $summary) {
            DB::table('roles')->where('id', $id)->update(['summary' => $summary]);
        }
    }

    public function down(): void
    {
        // Deskripsi lama tidak dipulihkan — hanya teks tampilan.
    }
};
