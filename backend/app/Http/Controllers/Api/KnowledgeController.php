<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Audit;
use App\Models\AuditLog;
use App\Models\Document;
use App\Models\DocumentRelation;
use App\Models\DraftingProject;
use App\Models\Finding;
use App\Models\LegalRequirement;
use App\Models\Record;
use App\Models\Risk;
use App\Models\Standard;
use App\Models\StandardClause;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Knowledge Base & Discovery.
 *
 * Pencarian terpadu lintas modul: setiap jenis hasil HANYA diikutkan bila
 * pengguna punya izin lihat modul tsb., dan dokumen selalu disaring
 * Document::visibleTo — pencarian tidak boleh jadi jalan pintas melihat
 * data yang di halaman aslinya terlarang. Pencarian mencakup metadata &
 * ringkasan isi yang tersimpan di database; teks DI DALAM berkas PDF belum
 * diindeks (belum ada ekstraksi teks/OCR).
 *
 * Relevansi sederhana & dapat dijelaskan: kode persis > kode diawali >
 * judul memuat > isi/keterangan memuat.
 */
class KnowledgeController extends Controller
{
    private const PER_TYPE = 8;

    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->string('q'));
        if (mb_strlen($q) < 2) {
            return response()->json(['query' => $q, 'groups' => [], 'total' => 0]);
        }

        $user = $request->user();
        $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $q).'%';

        $groups = collect([
            $this->documents($user, $q, $like),
            $user->hasPermission(Permissions::RECORDS_VIEW) ? $this->records($q, $like) : null,
            $user->hasPermission(Permissions::RISK_VIEW) ? $this->risks($q, $like) : null,
            $this->canViewFindings($user) ? $this->findings($q, $like) : null,
            $user->hasPermission(Permissions::LEGAL_VIEW) ? $this->legal($q, $like) : null,
            $user->hasPermission(Permissions::AUDIT_PROGRAM_VIEW) ? $this->audits($q, $like) : null,
            $this->drafting($user, $q, $like),
            $user->hasPermission(Permissions::REPORTING_VIEW) ? $this->clauses($q, $like) : null,
        ])->filter(fn ($g) => $g && $g['items']->isNotEmpty())->values();

        return response()->json([
            'query' => $q,
            'groups' => $groups,
            'total' => $groups->sum(fn ($g) => $g['items']->count()),
        ]);
    }

    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();
        $visible = fn () => Document::visibleTo($user);
        $releasedVisible = fn () => $visible()->where('status', 'released');

        $byStandard = Standard::where('active', true)->orderBy('code')
            ->withCount(['documents' => fn ($d) => $d->visibleTo($user)->where('status', 'released')])
            ->get(['code', 'name'])->filter(fn ($s) => $s->documents_count > 0)->values();

        $byFunction = $releasedVisible()->selectRaw('function_id, count(*) as c')->groupBy('function_id')
            ->with('orgFunction:id,name')->get()
            ->map(fn ($r) => ['id' => $r->function_id, 'name' => $r->orgFunction?->name ?? $r->function_id, 'count' => (int) $r->c])
            ->sortByDesc('count')->values();

        $byType = $releasedVisible()->selectRaw('type, count(*) as c')->groupBy('type')->pluck('c', 'type');

        // Paling sering diakses 90 hari terakhir — hanya yang masih boleh dilihat pengguna ini.
        $hits = AuditLog::whereIn('action', ['view', 'download'])->where('created_at', '>=', now()->subDays(90))
            ->whereNotNull('entity_label')->selectRaw('entity_label, count(*) as hits')->groupBy('entity_label')
            ->orderByDesc('hits')->limit(30)->pluck('hits', 'entity_label');
        $popular = $visible()->whereIn('code', $hits->keys())->get(['id', 'code', 'title', 'type', 'status'])
            ->map(fn ($d) => [...$d->only(['id', 'code', 'title', 'type', 'status']), 'hits' => (int) $hits[$d->code]])
            ->sortByDesc('hits')->take(6)->values();

        return response()->json([
            'by_standard' => $byStandard,
            'by_function' => $byFunction,
            'by_type' => $byType,
            'popular' => $popular,
            'recent' => $releasedVisible()->whereNotNull('effective_date')->orderByDesc('effective_date')->limit(6)
                ->get(['id', 'code', 'title', 'type', 'effective_date']),
            'review_soon' => $releasedVisible()->whereNotNull('review_date')
                ->whereDate('review_date', '>', now()->toDateString())->whereDate('review_date', '<=', now()->addDays(60)->toDateString())
                ->orderBy('review_date')->limit(6)->get(['id', 'code', 'title', 'review_date']),
            'totals' => ['released' => $releasedVisible()->count()],
        ]);
    }

    /** Dokumen terkait: relasi eksplisit > standar sama > kategori sama > fungsi sama > kata kunci sama. */
    public function related(Request $request, Document $document): JsonResponse
    {
        $this->authorize('view', $document);
        $user = $request->user();

        $standards = $document->standards()->pluck('standards.code')->all();
        $categories = $document->categories()->pluck('document_categories.id')->all();
        $keywords = collect($document->keywords ?? [])->map(fn ($k) => mb_strtolower($k))->filter()->all();
        $explicit = DocumentRelation::where('document_id', $document->id)->pluck('type', 'target_document_id');

        $candidates = Document::visibleTo($user)->whereKeyNot($document->id)
            ->where(fn ($w) => $w
                ->whereIn('id', $explicit->keys())
                ->orWhereHas('standards', fn ($s) => $s->whereIn('standards.code', $standards ?: ['__none__']))
                ->orWhereHas('categories', fn ($c) => $c->whereIn('document_categories.id', $categories ?: [0]))
                ->orWhere('function_id', $document->function_id))
            ->with(['standards:code', 'categories:id'])
            ->limit(200)->get(['id', 'code', 'title', 'type', 'status', 'function_id', 'keywords']);

        $scored = $candidates->map(function (Document $d) use ($document, $standards, $categories, $keywords, $explicit) {
            $score = 0;
            $reasons = [];
            if ($explicit->has($d->id)) {
                $score += 10;
                $reasons[] = 'relasi dokumen';
            }
            if ($shared = array_values(array_intersect($standards, $d->standards->pluck('code')->all()))) {
                $score += 3 * count($shared);
                $reasons[] = 'standar '.implode(', ', $shared);
            }
            if (array_intersect($categories, $d->categories->pluck('id')->all())) {
                $score += 2;
                $reasons[] = 'kategori sama';
            }
            if ($d->function_id === $document->function_id) {
                $score += 1;
                $reasons[] = 'fungsi sama';
            }
            $kw = array_intersect($keywords, collect($d->keywords ?? [])->map(fn ($k) => mb_strtolower($k))->all());
            if ($kw) {
                $score += 2 * count($kw);
                $reasons[] = 'kata kunci '.implode(', ', $kw);
            }

            return ['id' => $d->id, 'code' => $d->code, 'title' => $d->title, 'type' => $d->type, 'status' => $d->status, 'score' => $score, 'reasons' => $reasons];
        })->sortByDesc('score')->take(6)->values();

        return response()->json(['related' => $scored]);
    }

    // ---- Per jenis ------------------------------------------------------

    private function group(string $type, string $label, Collection $items): array
    {
        return ['type' => $type, 'label' => $label, 'items' => $items->sortByDesc('score')->take(self::PER_TYPE)->values()];
    }

    /** Skor relevansi + potongan teks di sekitar kecocokan pertama. */
    private function hit(string $q, ?string $code, string $title, array $bodies, array $extra): array
    {
        $ql = mb_strtolower($q);
        $score = 0;
        if ($code && mb_strtolower($code) === $ql) {
            $score = 100;
        } elseif ($code && str_starts_with(mb_strtolower($code), $ql)) {
            $score = 80;
        } elseif (str_contains(mb_strtolower($title), $ql)) {
            $score = 60 - min(20, (int) (mb_strlen($title) / 10)); // judul pendek yang cocok lebih relevan
        } elseif ($code && str_contains(mb_strtolower($code), $ql)) {
            $score = 40;
        } else {
            $score = 20;
        }

        $snippet = null;
        foreach ($bodies as $body) {
            if (! $body) {
                continue;
            }
            $pos = mb_stripos($body, $q);
            if ($pos !== false) {
                $start = max(0, $pos - 60);
                $snippet = ($start > 0 ? '…' : '').mb_substr($body, $start, 180).(mb_strlen($body) > $start + 180 ? '…' : '');
                break;
            }
        }

        return ['code' => $code, 'title' => $title, 'snippet' => $snippet, 'score' => $score, ...$extra];
    }

    private function documents(User $user, string $q, string $like): array
    {
        $rows = Document::visibleTo($user)
            ->where(fn ($w) => $w->whereRaw("code LIKE ? ESCAPE '!'", [$like])->orWhereRaw("title LIKE ? ESCAPE '!'", [$like])
                ->orWhereRaw("content LIKE ? ESCAPE '!'", [$like])->orWhereRaw("keywords LIKE ? ESCAPE '!'", [$like]))
            ->with('orgFunction:id,name')->limit(40)
            ->get(['id', 'code', 'title', 'type', 'status', 'function_id', 'content', 'keywords']);

        return $this->group('document', 'Dokumen', $rows->map(fn ($d) => $this->hit($q, $d->code, $d->title,
            [$d->content, implode(', ', $d->keywords ?? [])],
            ['url' => "/documents/{$d->id}", 'meta' => trim("{$d->type} · ".($d->orgFunction?->name ?? '')." · {$d->status}", ' ·')])));
    }

    private function records(string $q, string $like): array
    {
        $rows = Record::where(fn ($w) => $w->whereRaw("code LIKE ? ESCAPE '!'", [$like])->orWhereRaw("title LIKE ? ESCAPE '!'", [$like])
            ->orWhereRaw("description LIKE ? ESCAPE '!'", [$like])->orWhereRaw("location LIKE ? ESCAPE '!'", [$like]))
            ->with('series:id,code')->limit(40)->get(['id', 'code', 'title', 'description', 'location', 'status', 'series_id']);

        return $this->group('record', 'Rekaman', $rows->map(fn ($r) => $this->hit($q, $r->code, $r->title, [$r->description, $r->location],
            ['url' => '/records?q='.urlencode($r->code), 'meta' => "Seri {$r->series?->code} · {$r->status}".($r->location ? " · {$r->location}" : '')])));
    }

    private function risks(string $q, string $like): array
    {
        $rows = Risk::where(fn ($w) => $w->whereRaw("code LIKE ? ESCAPE '!'", [$like])->orWhereRaw("title LIKE ? ESCAPE '!'", [$like])
            ->orWhereRaw("description LIKE ? ESCAPE '!'", [$like])->orWhereRaw("treatment_plan LIKE ? ESCAPE '!'", [$like]))
            ->limit(40)->get(['id', 'code', 'title', 'description', 'treatment_plan', 'residual_level', 'status']);

        return $this->group('risk', 'Risiko', $rows->map(fn ($r) => $this->hit($q, $r->code, $r->title, [$r->description, $r->treatment_plan],
            ['url' => '/risk-register?q='.urlencode($r->code), 'meta' => "Residual {$r->residual_level} · {$r->status}"])));
    }

    private function findings(string $q, string $like): array
    {
        $rows = Finding::where(fn ($w) => $w->whereRaw("code LIKE ? ESCAPE '!'", [$like])->orWhereRaw("title LIKE ? ESCAPE '!'", [$like])
            ->orWhereRaw("description LIKE ? ESCAPE '!'", [$like])->orWhereRaw("clause_reference LIKE ? ESCAPE '!'", [$like]))
            ->limit(40)->get(['id', 'code', 'title', 'description', 'clause_reference', 'type', 'status']);

        return $this->group('finding', 'Temuan & CAPA', $rows->map(fn ($f) => $this->hit($q, $f->code, $f->title, [$f->description, $f->clause_reference],
            ['url' => '/findings?q='.urlencode($f->code), 'meta' => "{$f->type} · {$f->status}".($f->clause_reference ? " · {$f->clause_reference}" : '')])));
    }

    private function legal(string $q, string $like): array
    {
        $rows = LegalRequirement::where(fn ($w) => $w->whereRaw("code LIKE ? ESCAPE '!'", [$like])->orWhereRaw("title LIKE ? ESCAPE '!'", [$like])
            ->orWhereRaw("regulation_number LIKE ? ESCAPE '!'", [$like])->orWhereRaw("obligations LIKE ? ESCAPE '!'", [$like])->orWhereRaw("summary LIKE ? ESCAPE '!'", [$like]))
            ->limit(40)->get(['id', 'code', 'title', 'regulation_number', 'obligations', 'summary', 'compliance_status', 'status']);

        return $this->group('legal', 'Peraturan', $rows->map(fn ($l) => $this->hit($q, $l->regulation_number ?: $l->code, $l->title, [$l->obligations, $l->summary],
            ['url' => '/legal-register?q='.urlencode($l->regulation_number ?: $l->code), 'meta' => "{$l->code} · kepatuhan: {$l->compliance_status}"])));
    }

    private function audits(string $q, string $like): array
    {
        $rows = Audit::where(fn ($w) => $w->whereRaw("code LIKE ? ESCAPE '!'", [$like])->orWhereRaw("title LIKE ? ESCAPE '!'", [$like])
            ->orWhereRaw("scope LIKE ? ESCAPE '!'", [$like])->orWhereRaw("summary LIKE ? ESCAPE '!'", [$like]))
            ->limit(40)->get(['id', 'code', 'title', 'scope', 'summary', 'type', 'status']);

        return $this->group('audit', 'Audit', $rows->map(fn ($a) => $this->hit($q, $a->code, $a->title, [$a->scope, $a->summary],
            ['url' => ($a->type === 'external' ? '/audit-external' : '/audit-internal').'?q='.urlencode($a->code), 'meta' => "Audit {$a->type} · {$a->status}"])));
    }

    private function drafting(User $user, string $q, string $like): ?array
    {
        $involved = collect([Permissions::DOCUMENT_DRAFT, Permissions::DOCUMENT_CONTROL, Permissions::DOCUMENT_RATIFY,
            Permissions::DOCUMENT_REVIEW, Permissions::DOCUMENT_APPROVE, Permissions::AUDIT_VIEW])->contains(fn ($p) => $user->hasPermission($p));
        if (! $involved && ! $user->hasPermission(Permissions::DOCUMENT_REQUEST)) {
            return null;
        }

        $rows = DraftingProject::where(fn ($w) => $w->whereRaw("code LIKE ? ESCAPE '!'", [$like])->orWhereRaw("title LIKE ? ESCAPE '!'", [$like])->orWhereRaw("reason LIKE ? ESCAPE '!'", [$like]))
            ->when(! $involved, fn ($w) => $w->where('requester_id', $user->id))
            ->limit(40)->get(['id', 'code', 'title', 'reason', 'status', 'doc_type']);

        return $this->group('drafting', 'Proyek Penyusunan', $rows->map(fn ($p) => $this->hit($q, $p->code, $p->title, [$p->reason],
            ['url' => "/drafting/{$p->id}", 'meta' => "{$p->doc_type} · {$p->status}"])));
    }

    private function clauses(string $q, string $like): array
    {
        $rows = StandardClause::where(fn ($w) => $w->whereRaw("title LIKE ? ESCAPE '!'", [$like])->orWhereRaw("code LIKE ? ESCAPE '!'", [$like]))
            ->limit(40)->get(['id', 'standard_code', 'code', 'title']);

        return $this->group('clause', 'Klausul Standar', $rows->map(fn ($c) => $this->hit($q, "{$c->standard_code} {$c->code}", $c->title, [],
            ['url' => '/compliance-matrix', 'meta' => "Klausul {$c->code} {$c->standard_code}"])));
    }

    private function canViewFindings(User $user): bool
    {
        return $user->hasPermission(Permissions::AUDIT_VIEW)
            || $user->hasPermission(Permissions::FINDING_MANAGE)
            || $user->hasPermission(Permissions::FINDING_CLOSE);
    }
}
