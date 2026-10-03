<?php

namespace App\Models\Concerns;

use App\Models\User;
use App\Support\Permissions;

/**
 * Aturan need-to-know berdasarkan label klasifikasi (ISO 27001 5.12), dipakai
 * bersama oleh Dokumen, Rekaman, dan Proyek Penyusunan supaya label yang sama
 * berarti pembatasan yang sama di semua modul:
 * - izin klasifikasi tertinggi per peran (Permissions::ROLE_CLEARANCE),
 * - +1 tingkat untuk data milik fungsi pengguna sendiri (maks. Secret),
 * - orang yang tercatat pada kolom kepemilikan (pemilik/pembuat/pemohon/
 *   penyusun) selalu boleh melihat datanya sendiri.
 *
 * Model pemakai mendefinisikan CLASSIFICATION_OWNER_COLUMNS.
 */
trait Classified
{
    public function scopeClassifiedFor($query, User $user)
    {
        $roleIds = $user->roleIds();
        $general = Permissions::classificationsUpTo(Permissions::clearanceFor($roleIds));
        $ownFunction = Permissions::classificationsUpTo(Permissions::clearanceFor($roleIds, ownFunction: true));

        return $query->where(function ($q) use ($user, $general, $ownFunction) {
            $q->whereIn($this->qualifyColumn('classification'), $general);
            foreach (static::CLASSIFICATION_OWNER_COLUMNS as $column) {
                $q->orWhere($this->qualifyColumn($column), $user->id);
            }
            if ($user->function_id) {
                $q->orWhere(fn ($w) => $w->where($this->qualifyColumn('function_id'), $user->function_id)
                    ->whereIn($this->qualifyColumn('classification'), $ownFunction));
            }
        });
    }

    /** Versi satu-baris dari scopeClassifiedFor. */
    public function classificationAllows(User $user): bool
    {
        foreach (static::CLASSIFICATION_OWNER_COLUMNS as $column) {
            if ($this->{$column} !== null && (int) $this->{$column} === (int) $user->id) {
                return true;
            }
        }
        // Label tak dikenal diperlakukan paling ketat.
        $level = Permissions::CLASSIFICATION_LEVELS[$this->classification] ?? Permissions::CLASSIFICATION_LEVELS['top_secret'];
        $own = $user->function_id !== null && $user->function_id === $this->function_id;

        return $level <= Permissions::clearanceFor($user->roleIds(), ownFunction: $own);
    }
}
