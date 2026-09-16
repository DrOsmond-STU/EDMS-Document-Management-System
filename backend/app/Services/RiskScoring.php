<?php

namespace App\Services;

/**
 * Matriks 5×5 Likelihood × Impact standar ISO 31000 — skor = L × I (1-25),
 * dipetakan ke 4 pita level. Satu-satunya tempat aturan pemetaan ini
 * ditulis, dipakai baik saat menyimpan risiko baru maupun saat menghitung
 * ulang level di tes, supaya tidak ada dua definisi yang bisa berbeda.
 */
final class RiskScoring
{
    /** @return 'low'|'moderate'|'high'|'extreme' */
    public static function level(int $likelihood, int $impact): string
    {
        $score = $likelihood * $impact;

        return match (true) {
            $score >= 20 => 'extreme',
            $score >= 12 => 'high',
            $score >= 6 => 'moderate',
            default => 'low',
        };
    }
}
