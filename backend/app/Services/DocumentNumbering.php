<?php

namespace App\Services;

use App\Models\Document;

/**
 * Penomoran dokumen: JENIS-FUNGSI-NNN, mis. SOP-QA-001.
 *
 * Nomor diambil di dalam transaksi dengan mengunci baris dokumen terakhir
 * pada awalan yang sama, supaya dua orang yang membuat dokumen bersamaan
 * tidak mendapat nomor kembar — masalah yang tidak bisa dicegah oleh
 * penyimpanan JSON lama.
 */
class DocumentNumbering
{
    private const TYPE_CODES = [
        'Kebijakan' => 'KBJ',
        'Manual' => 'MAN',
        'SOP' => 'SOP',
        'Work Instruction' => 'WI',
        'Formulir' => 'FRM',
    ];

    public static function typeCode(string $type): string
    {
        return self::TYPE_CODES[$type] ?? 'DOC';
    }

    public function nextCode(string $type, string $functionId): string
    {
        $prefix = self::typeCode($type).'-'.strtoupper($functionId);

        $last = Document::withTrashed()
            ->where('code', 'like', $prefix.'-%')
            ->orderByDesc('code')
            ->lockForUpdate()
            ->value('code');

        $next = 1;
        if ($last !== null && preg_match('/-(\d+)$/', $last, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix.'-'.str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }
}
