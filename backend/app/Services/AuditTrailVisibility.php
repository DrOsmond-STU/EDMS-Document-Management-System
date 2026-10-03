<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Document;
use App\Models\DocumentComment;
use App\Models\DocumentFile;
use App\Models\DraftingProject;
use App\Models\Record;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Audit trail tetap lengkap (siapa, kapan, aksi apa), tetapi judul & detail
 * kegiatan atas data berklasifikasi di atas izin pembaca disembunyikan —
 * label klasifikasi tidak boleh bisa dilangkahi lewat jejak audit (mis.
 * System Administrator yang izinnya hanya Internal membaca judul dokumen
 * Top Secret). Pencarian teks juga tidak menyentuh baris tersebut, supaya
 * tidak bisa dipakai menebak isi judul/detailnya.
 */
class AuditTrailVisibility
{
    public const MASKED_LABEL = '(dibatasi)';

    public const MASKED_DETAIL = 'Detail disembunyikan — klasifikasi data di atas izin Anda.';

    /** @var array<int, array<string, list<string>>> */
    private array $cache = [];

    /** @return array<string, list<string>> entity => entity_id yang tidak boleh dibaca $user */
    public function restricted(User $user): array
    {
        if (isset($this->cache[$user->id])) {
            return $this->cache[$user->id];
        }

        $hiddenDocs = Document::withTrashed()
            ->whereNotIn('id', Document::withTrashed()->classifiedFor($user)->select('id'))
            ->get(['id', 'code']);
        $hiddenDocIds = $hiddenDocs->pluck('id')->all();
        $str = fn ($c) => $c->map(fn ($v) => (string) $v)->values()->all();

        return $this->cache[$user->id] = array_filter([
            // Dokumen dicatat dengan id maupun kode (aksi supersede).
            'Document' => [...$str($hiddenDocs->pluck('id')), ...$str($hiddenDocs->pluck('code'))],
            'DocumentFile' => $hiddenDocIds ? $str(DocumentFile::withTrashed()->whereIn('document_id', $hiddenDocIds)->pluck('id')) : [],
            'DocumentComment' => $hiddenDocIds ? $str(DocumentComment::withTrashed()->whereIn('document_id', $hiddenDocIds)->pluck('id')) : [],
            'Record' => $str(Record::withTrashed()->whereNotIn('id', Record::withTrashed()->classifiedFor($user)->select('id'))->pluck('code')),
            'DraftingProject' => $str(DraftingProject::withTrashed()->whereNotIn('id', DraftingProject::withTrashed()->classifiedFor($user)->select('id'))->pluck('code')),
        ]);
    }

    /** Batasi query ke baris yang boleh dibaca penuh (dipakai untuk pencarian teks). */
    public function onlyReadable(Builder $query, User $user): Builder
    {
        foreach ($this->restricted($user) as $entity => $ids) {
            $query->where(fn ($w) => $w->where('entity', '!=', $entity)->orWhereNull('entity_id')->orWhereNotIn('entity_id', $ids));
        }

        return $query;
    }

    public function isRestricted(AuditLog $log, User $user): bool
    {
        $ids = $this->restricted($user)[$log->entity] ?? [];

        return $log->entity_id !== null && in_array((string) $log->entity_id, $ids, true);
    }

    public function mask(AuditLog $log, User $user): AuditLog
    {
        if ($this->isRestricted($log, $user)) {
            $log->entity_label = self::MASKED_LABEL;
            $log->detail = self::MASKED_DETAIL;
            $log->setAttribute('restricted', true);
        }

        return $log;
    }
}
