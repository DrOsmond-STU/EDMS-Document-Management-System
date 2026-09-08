<?php

namespace App\Services;

use App\Models\Document;
use App\Models\NumberingSetting;

/**
 * Penomoran dokumen berdasarkan formula yang bisa diatur sendiri lewat
 * halaman Pengaturan Penomoran (lihat NumberingSetting, NumberingSettingController).
 * Bawaan: JENIS-FUNGSI-NNN, mis. SOP-QA-001 — sama seperti sebelum formula
 * ini bisa diatur, supaya klien yang belum pernah menyentuh pengaturan
 * tidak melihat perubahan apa pun.
 *
 * Token yang didukung: {type} (kode jenis dokumen), {function} (id fungsi,
 * huruf besar), {year} (4 digit), {yy} (2 digit), {seq} (nomor urut).
 * {seq} WAJIB jadi token TERAKHIR dalam format (ditegakkan saat formula
 * disimpan, lihat NumberingSettingController) — supaya "kode terakhir
 * dengan awalan yang sama" tetap satu pencarian LIKE 'prefix%' yang benar,
 * bukan pola pencocokan sembarang posisi.
 *
 * Nomor diambil di dalam transaksi dengan mengunci baris dokumen terakhir
 * pada awalan yang sama, supaya dua orang yang membuat dokumen bersamaan
 * tidak mendapat nomor kembar — masalah yang tidak bisa dicegah oleh
 * penyimpanan JSON lama.
 */
class DocumentNumbering
{
    public function nextCode(string $type, string $functionId): string
    {
        $settings = NumberingSetting::current();
        $prefix = $this->prefixFor($settings, $type, $functionId);

        $last = Document::withTrashed()
            ->where('code', 'like', $prefix.'%')
            ->orderByDesc('code')
            ->lockForUpdate()
            ->value('code');

        $next = 1;
        if ($last !== null && preg_match('/(\d+)$/', $last, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        $padding = max(1, $settings->seq_padding ?: 3);

        return $prefix.str_pad((string) $next, $padding, '0', STR_PAD_LEFT);
    }

    /** Bagian format SEBELUM {seq} — dipakai untuk mengunci & mencari nomor terakhir. */
    public function prefixFor(NumberingSetting $settings, string $type, string $functionId): string
    {
        $format = $settings->format ?: NumberingSetting::DEFAULT_FORMAT;
        $beforeSeq = strstr($format, '{seq}', true);
        $beforeSeq = $beforeSeq === false ? $format : $beforeSeq;

        return strtr($beforeSeq, [
            '{type}' => $settings->typeCode($type),
            '{function}' => strtoupper($functionId),
            '{year}' => now()->format('Y'),
            '{yy}' => now()->format('y'),
        ]);
    }

    /** Contoh hasil untuk pratinjau di halaman pengaturan — tidak menyentuh database. */
    public function preview(NumberingSetting $settings, string $type = 'SOP', string $functionId = 'qa'): string
    {
        $prefix = $this->prefixFor($settings, $type, $functionId);
        $padding = max(1, $settings->seq_padding ?: 3);

        return $prefix.str_pad('1', $padding, '0', STR_PAD_LEFT);
    }
}
