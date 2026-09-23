<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiGeneration;
use App\Models\Document;
use App\Models\DraftingProject;
use App\Models\LegalRequirement;
use App\Models\OrgFunction;
use App\Models\Standard;
use App\Models\StandardClause;
use App\Models\User;
use App\Services\AiAssistant;
use App\Services\AiUnavailable;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;

/**
 * Asisten AI (PRD: "Pencarian & Regulasi" dan "Rancang Dokumen Baru").
 *
 * Prinsip:
 * 1. Deteksi duplikat bersifat DETERMINISTIK (pencocokan kata kunci pada
 *    dokumen yang boleh dilihat pengguna) — tetap berfungsi walau AI mati.
 * 2. AI hanya diberi katalog nyata (standar, klausul, fungsi, jenis
 *    dokumen, Legal Register) dan setiap referensi yang dikembalikannya
 *    DICOCOKKAN ULANG ke database. Referensi yang tidak ada dibuang —
 *    kecuali "regulasi eksternal" yang memang ditandai perlu verifikasi.
 * 3. Hasil AI selalu berlabel rekomendasi yang perlu ditinjau manusia; AI
 *    tidak pernah membuat/mengubah dokumen sendiri. Tindak lanjut (membuat
 *    permintaan penyusunan) dilakukan pengguna lewat alur Drafting biasa.
 */
class AiAssistantController extends Controller
{
    public const DOC_TYPES = ['Kebijakan', 'Manual', 'SOP', 'Work Instruction', 'Formulir'];

    /** Batas panggilan per pengguna per jam — kendali biaya API. */
    private const HOURLY_LIMIT = 20;

    private const STOPWORDS = [
        'dan', 'yang', 'untuk', 'dengan', 'dari', 'pada', 'atau', 'dalam', 'ini', 'itu', 'akan', 'agar',
        'oleh', 'sebagai', 'tentang', 'kami', 'kita', 'perlu', 'butuh', 'membuat', 'buat', 'baru',
        'dokumen', 'the', 'and', 'for', 'with',
    ];

    public function __construct(private AiAssistant $ai, private AuditLogger $audit) {}

    public function status(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasPermission(Permissions::AI_USE)) {
            return $this->forbidden();
        }

        $history = AiGeneration::where('user_id', $user->id)->latest('id')->limit(10)
            ->get(['id', 'kind', 'subject', 'model', 'input_tokens', 'output_tokens', 'followed_up_at', 'followed_up_ref', 'created_at']);

        return response()->json([
            'configured' => $this->ai->configured(),
            'model' => $this->ai->model(),
            'can_request' => $this->canRequest($user),
            'remaining' => RateLimiter::remaining($this->limiterKey($user), self::HOURLY_LIMIT),
            'history' => $history,
            'meta' => [
                'doc_types' => self::DOC_TYPES,
                'functions' => OrgFunction::where('active', true)->orderBy('name')->get(['id', 'name']),
                'standards' => Standard::where('active', true)->orderBy('code')->get(['code', 'name']),
            ],
        ]);
    }

    public function show(Request $request, AiGeneration $generation): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::AI_USE) || $generation->user_id !== $request->user()->id) {
            return $this->forbidden();
        }

        return response()->json(['generation' => $generation]);
    }

    /** Pencarian & Regulasi: cek duplikat + rekomendasi jenis/standar/klausul/regulasi. */
    public function discover(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasPermission(Permissions::AI_USE)) {
            return $this->forbidden();
        }
        $data = $request->validate([
            'topic' => ['required', 'string', 'min:5', 'max:500'],
            'context' => ['nullable', 'string', 'max:2000'],
            'function_id' => ['nullable', 'exists:org_functions,id'],
        ]);

        $keywords = $this->keywords($data['topic']);
        $matches = $this->similarDocuments($user, $data['topic'], $keywords);
        $drafts = $this->similarDrafts($user, $keywords);

        $response = ['keywords' => $keywords, 'matches' => $matches, 'drafts' => $drafts, 'ai' => null, 'ai_error' => null];

        if (! $this->ai->configured()) {
            $response['ai_error'] = 'Asisten AI belum dikonfigurasi — hanya hasil pencocokan dokumen yang ditampilkan.';

            return response()->json($response);
        }
        if ($limited = $this->hitLimit($user)) {
            $response['ai_error'] = $limited;

            return response()->json($response);
        }

        $catalog = $this->catalog(null);
        $candidateLines = collect($matches)->map(fn ($d) => "- {$d['code']} | {$d['title']} | {$d['type']} | status {$d['status']}")->implode("\n") ?: '(tidak ada)';
        $functionName = isset($data['function_id']) ? OrgFunction::find($data['function_id'])?->name : null;

        $prompt = implode("\n\n", array_filter([
            "KEBUTUHAN PENGGUNA:\n".$data['topic'],
            ! empty($data['context']) ? "KONTEKS TAMBAHAN:\n".$data['context'] : null,
            $functionName ? "FUNGSI/UNIT PEMOHON: {$functionName} (id {$data['function_id']})" : null,
            "DOKUMEN YANG SUDAH ADA DAN MIRIP (hasil pencocokan kata kunci):\n".$candidateLines,
            $catalog,
        ]));

        $schema = $this->discoverSchema();

        try {
            [$generation, $result] = $this->ai->generate(
                $user, 'discover', $data['topic'], $this->discoverSystem(), $prompt, $schema, 'low', 6000,
            );
        } catch (AiUnavailable $e) {
            $response['ai_error'] = $e->getMessage();

            return response()->json($response);
        }

        $clean = $this->cleanDiscover($result, collect($matches)->pluck('code')->all());
        $generation->update(['result' => $clean]);

        $this->audit->log($user, 'create', 'AiGeneration', (string) $generation->id, $generation->subject,
            "Meminta rekomendasi Asisten AI untuk \"{$generation->subject}\".");

        $response['ai'] = ['generation_id' => $generation->id, ...$clean];

        return response()->json($response);
    }

    /** Rancang Dokumen Baru: kerangka + isi awal per bagian + pemetaan klausul. */
    public function draft(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasPermission(Permissions::AI_USE)) {
            return $this->forbidden();
        }
        $data = $request->validate([
            'title' => ['required', 'string', 'min:5', 'max:255'],
            'doc_type' => ['required', Rule::in(self::DOC_TYPES)],
            'function_id' => ['required', 'exists:org_functions,id'],
            'standards' => ['sometimes', 'array', 'max:4'],
            'standards.*' => ['string', 'exists:standards,code'],
            'notes' => ['nullable', 'string', 'max:3000'],
        ]);

        if (! $this->ai->configured()) {
            return response()->json(['message' => 'Asisten AI belum dikonfigurasi. Minta administrator mengaktifkannya di Integration & API.'], 422);
        }
        if ($limited = $this->hitLimit($user)) {
            return response()->json(['message' => $limited], 429);
        }

        $function = OrgFunction::find($data['function_id']);
        $standards = $data['standards'] ?? [];
        $prompt = implode("\n\n", array_filter([
            "JUDUL DOKUMEN: {$data['title']}",
            "JENIS DOKUMEN: {$data['doc_type']}",
            "FUNGSI/UNIT PEMILIK: {$function->name}",
            $standards ? 'STANDAR ACUAN YANG DIPILIH: '.implode(', ', $standards) : 'STANDAR ACUAN: belum dipilih — gunakan hanya bila jelas relevan.',
            ! empty($data['notes']) ? "CATATAN PENYUSUN:\n".$data['notes'] : null,
            $this->catalog($standards ?: null),
        ]));

        try {
            [$generation, $result] = $this->ai->generate(
                $user, 'draft', $data['title'], $this->draftSystem(), $prompt, $this->draftSchema(), 'medium', 16000,
            );
        } catch (AiUnavailable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $clean = $this->cleanDraft($result, $data);
        $generation->update(['result' => $clean]);

        $this->audit->log($user, 'create', 'AiGeneration', (string) $generation->id, $generation->subject,
            "Meminta rancangan awal dokumen \"{$generation->subject}\" dari Asisten AI.");

        return response()->json(['generation_id' => $generation->id, ...$clean]);
    }

    /** Teks polos rancangan untuk diisikan ke draf akhir proyek penyusunan. */
    public static function renderDraft(array $draft): string
    {
        $lines = [mb_strtoupper($draft['request']['title'] ?? ''), ''];
        if (! empty($draft['purpose'])) {
            $lines[] = '1. TUJUAN';
            $lines[] = $draft['purpose'];
            $lines[] = '';
        }
        if (! empty($draft['scope'])) {
            $lines[] = '2. RUANG LINGKUP';
            $lines[] = $draft['scope'];
            $lines[] = '';
        }
        $n = 3;
        foreach ($draft['sections'] ?? [] as $section) {
            $lines[] = $n++.'. '.mb_strtoupper($section['heading']);
            $lines[] = $section['content'];
            if (! empty($section['clause_refs'])) {
                $lines[] = '[Acuan: '.implode('; ', $section['clause_refs']).']';
            }
            $lines[] = '';
        }
        $lines[] = '— Rancangan awal dari Asisten AI; wajib ditinjau & disesuaikan penyusun sebelum finalisasi.';

        return trim(implode("\n", $lines));
    }

    // ---------------------------------------------------------------- matching

    /** @return list<string> */
    private function keywords(string $text): array
    {
        $words = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($text), -1, PREG_SPLIT_NO_EMPTY);

        return collect($words)
            ->filter(fn ($w) => mb_strlen($w) >= 4 && ! in_array($w, self::STOPWORDS, true))
            ->unique()->take(8)->values()->all();
    }

    private function like(string $w): string
    {
        return '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $w).'%';
    }

    /** @param list<string> $keywords */
    private function similarDocuments(User $user, string $topic, array $keywords): array
    {
        if (! $keywords) {
            return [];
        }

        $rows = Document::visibleTo($user)
            ->where(function ($w) use ($keywords) {
                foreach ($keywords as $k) {
                    $w->orWhereRaw("title LIKE ? ESCAPE '!'", [$this->like($k)])
                        ->orWhereRaw("keywords LIKE ? ESCAPE '!'", [$this->like($k)]);
                }
            })
            ->with('orgFunction:id,name')
            ->limit(60)->get(['id', 'code', 'title', 'type', 'status', 'function_id', 'keywords']);

        $total = count($keywords);

        return $rows->map(function (Document $d) use ($keywords, $total, $topic) {
            $hay = mb_strtolower($d->title.' '.implode(' ', $d->keywords ?? []));
            $hit = collect($keywords)->filter(fn ($k) => str_contains($hay, $k))->values();
            $exact = mb_strtolower(trim($d->title)) === mb_strtolower(trim($topic));
            $ratio = $hit->count() / $total;

            return [
                'id' => $d->id,
                'code' => $d->code,
                'title' => $d->title,
                'type' => $d->type,
                'status' => $d->status,
                'function' => $d->orgFunction?->name,
                'matched' => $hit->all(),
                'score' => $exact ? 1.0 : round($ratio, 2),
                'likely_duplicate' => $exact || ($total >= 2 && $ratio >= 0.6),
            ];
        })->sortByDesc('score')->take(8)->values()->all();
    }

    /** Permintaan penyusunan yang masih berjalan dengan judul mirip — cegah permintaan ganda. */
    private function similarDrafts(User $user, array $keywords): array
    {
        if (! $keywords) {
            return [];
        }
        $involved = collect([Permissions::DOCUMENT_DRAFT, Permissions::DOCUMENT_CONTROL, Permissions::DOCUMENT_RATIFY])
            ->contains(fn ($p) => $user->hasPermission($p));

        return DraftingProject::whereNotIn('status', ['ratified', 'rejected'])
            ->where(function ($w) use ($keywords) {
                foreach ($keywords as $k) {
                    $w->orWhereRaw("title LIKE ? ESCAPE '!'", [$this->like($k)]);
                }
            })
            ->when(! $involved, fn ($w) => $w->where('requester_id', $user->id))
            ->latest('id')->limit(5)->get(['id', 'code', 'title', 'status', 'doc_type'])
            ->toArray();
    }

    // ---------------------------------------------------------------- prompts

    /** Katalog referensi nyata. $standards membatasi klausul ke standar tertentu (null = semua). */
    private function catalog(?array $standards): string
    {
        $stdRows = Standard::where('active', true)->orderBy('code')->get(['code', 'name']);
        $clauses = StandardClause::query()
            ->whereIn('standard_code', $standards ?? $stdRows->pluck('code'))
            ->orderBy('standard_code')->orderBy('sort_order')->get(['standard_code', 'code', 'title'])
            ->groupBy('standard_code')
            ->map(fn (Collection $c, $std) => "{$std}: ".$c->map(fn ($x) => "{$x->code} {$x->title}")->implode('; '))
            ->implode("\n");
        $functions = OrgFunction::where('active', true)->orderBy('name')->get(['id', 'name'])
            ->map(fn ($f) => "{$f->id} = {$f->name}")->implode('; ');
        $legal = LegalRequirement::where('status', 'active')->orderBy('code')->limit(150)
            ->get(['code', 'title', 'regulation_number'])
            ->map(fn ($l) => "{$l->code} | {$l->regulation_number} | {$l->title}")->implode("\n");

        return implode("\n\n", [
            'KATALOG REFERENSI (HANYA gunakan kode dari katalog ini):',
            'Jenis dokumen: '.implode(', ', self::DOC_TYPES),
            "Fungsi/unit (id = nama): {$functions}",
            'Standar: '.$stdRows->map(fn ($s) => "{$s->code} ({$s->name})")->implode(', '),
            "Klausul standar:\n".($clauses ?: '(tidak ada)'),
            "Legal Register perusahaan (kode | nomor | judul):\n".($legal ?: '(kosong)'),
        ]);
    }

    private function discoverSystem(): string
    {
        return <<<'TXT'
Anda adalah konsultan sistem manajemen (ISO 9001/14001/45001/27001/37001/22301, SMK3) yang membantu Document Controller sebuah perusahaan Indonesia di aplikasi EDMS. Tugas: menilai kebutuhan dokumen yang diajukan pengguna, apakah sudah tercakup dokumen yang ada, dan merekomendasikan jenis dokumen, fungsi pemilik, standar, klausul, serta regulasi terkait.

Aturan:
- Tulis dalam Bahasa Indonesia yang ringkas dan profesional.
- Kode standar, klausul, fungsi, dan Legal Register HARUS diambil dari katalog yang diberikan. Jangan mengarang kode.
- Jika ada dokumen yang sudah ada yang tampak mencakup kebutuhan, rekomendasikan revisi/penggunaan dokumen tersebut (isi document_code dengan kodenya) alih-alih membuat baru. Jika tidak, isi document_code dengan string kosong.
- Regulasi Indonesia yang relevan tetapi TIDAK ada di Legal Register boleh disebut di external_regulations, cukup nama resminya yang Anda yakini ada; jangan menebak nomor pasal. Jika tidak yakin, kosongkan.
- Maksimal 8 klausul dan 6 regulasi, urut dari paling relevan.
TXT;
    }

    private function draftSystem(): string
    {
        return <<<'TXT'
Anda adalah penyusun dokumen sistem manajemen berpengalaman untuk perusahaan Indonesia. Susun RANCANGAN AWAL dokumen sesuai jenisnya (Kebijakan: pernyataan komitmen singkat; Manual: gambaran sistem; SOP: tujuan, ruang lingkup, definisi, tanggung jawab, langkah prosedur bernomor, rekaman; Work Instruction: langkah kerja rinci; Formulir: daftar isian).

Aturan:
- Bahasa Indonesia baku, jelas, dapat langsung disunting penyusun.
- Rujuk klausul hanya dari katalog yang diberikan (format "KODESTANDAR klausul", mis. "ISO9001 7.5"). Jangan mengarang klausul, nomor regulasi, atau angka/ambang teknis yang tidak diberikan pengguna — tulis "[isi sesuai kondisi perusahaan]" sebagai penanda.
- Jangan menulis tujuan dan ruang lingkup lagi di dalam sections (sudah ada di field purpose dan scope).
- review_notes berisi hal yang wajib diverifikasi atau dilengkapi manusia.
TXT;
    }

    private function discoverSchema(): array
    {
        $str = ['type' => 'string'];
        $obj = fn (array $props) => ['type' => 'object', 'properties' => $props, 'required' => array_keys($props), 'additionalProperties' => false];

        return $obj([
            'summary' => $str,
            'recommendation' => $obj([
                'action' => ['type' => 'string', 'enum' => ['buat_baru', 'revisi_dokumen_ada', 'gunakan_dokumen_ada']],
                'document_code' => $str,
                'reason' => $str,
            ]),
            'proposed' => $obj([
                'title' => $str,
                'doc_type' => ['type' => 'string', 'enum' => self::DOC_TYPES],
                'function_id' => $str,
                'standards' => ['type' => 'array', 'items' => $str],
                'reason' => $str,
            ]),
            'clauses' => ['type' => 'array', 'items' => $obj(['standard' => $str, 'clause' => $str, 'why' => $str])],
            'legal' => ['type' => 'array', 'items' => $obj(['code' => $str, 'why' => $str])],
            'external_regulations' => ['type' => 'array', 'items' => $obj(['name' => $str, 'why' => $str])],
            'notes' => ['type' => 'array', 'items' => $str],
        ]);
    }

    private function draftSchema(): array
    {
        $str = ['type' => 'string'];
        $obj = fn (array $props) => ['type' => 'object', 'properties' => $props, 'required' => array_keys($props), 'additionalProperties' => false];

        return $obj([
            'purpose' => $str,
            'scope' => $str,
            'sections' => ['type' => 'array', 'items' => $obj([
                'heading' => $str,
                'content' => $str,
                'clause_refs' => ['type' => 'array', 'items' => $str],
            ])],
            'legal' => ['type' => 'array', 'items' => $obj(['code' => $str, 'why' => $str])],
            'review_notes' => ['type' => 'array', 'items' => $str],
        ]);
    }

    // ---------------------------------------------------------------- validation of AI output

    /** @return array<string, array{title: string}> kunci "STD klausul" */
    private function clauseIndex(): array
    {
        return StandardClause::get(['standard_code', 'code', 'title'])
            ->mapWithKeys(fn ($c) => ["{$c->standard_code} {$c->code}" => ['standard' => $c->standard_code, 'clause' => $c->code, 'title' => $c->title]])
            ->all();
    }

    private function legalIndex(): Collection
    {
        return LegalRequirement::get(['id', 'code', 'title', 'regulation_number'])->keyBy('code');
    }

    private function cleanDiscover(array $r, array $candidateCodes): array
    {
        $clauseIndex = $this->clauseIndex();
        $legalIndex = $this->legalIndex();
        $activeStandards = Standard::where('active', true)->pluck('code')->all();
        $dropped = 0;

        $rec = $r['recommendation'] ?? [];
        $action = in_array($rec['action'] ?? '', ['buat_baru', 'revisi_dokumen_ada', 'gunakan_dokumen_ada'], true) ? $rec['action'] : 'buat_baru';
        $docCode = in_array($rec['document_code'] ?? '', $candidateCodes, true) ? $rec['document_code'] : '';
        if ($action !== 'buat_baru' && $docCode === '') {
            $dropped++;
        }
        $docId = $docCode !== '' ? Document::where('code', $docCode)->value('id') : null;

        $proposed = $r['proposed'] ?? [];
        $functionId = OrgFunction::whereKey($proposed['function_id'] ?? '')->exists() ? $proposed['function_id'] : null;
        $standards = array_values(array_intersect(array_unique($proposed['standards'] ?? []), $activeStandards));

        $clauses = [];
        foreach ($r['clauses'] ?? [] as $c) {
            $key = trim(($c['standard'] ?? '').' '.($c['clause'] ?? ''));
            if (isset($clauseIndex[$key])) {
                $clauses[$key] = [...$clauseIndex[$key], 'why' => (string) ($c['why'] ?? '')];
            } else {
                $dropped++;
            }
        }

        $legal = [];
        foreach ($r['legal'] ?? [] as $l) {
            $row = $legalIndex->get($l['code'] ?? '');
            if ($row) {
                $legal[$row->code] = ['id' => $row->id, 'code' => $row->code, 'title' => $row->title, 'regulation_number' => $row->regulation_number, 'why' => (string) ($l['why'] ?? '')];
            } else {
                $dropped++;
            }
        }

        return [
            'summary' => (string) ($r['summary'] ?? ''),
            'recommendation' => ['action' => $action, 'document_code' => $docCode, 'document_id' => $docId, 'reason' => (string) ($rec['reason'] ?? '')],
            'proposed' => [
                'title' => mb_substr((string) ($proposed['title'] ?? ''), 0, 255),
                'doc_type' => in_array($proposed['doc_type'] ?? '', self::DOC_TYPES, true) ? $proposed['doc_type'] : 'SOP',
                'function_id' => $functionId,
                'standards' => $standards,
                'reason' => (string) ($proposed['reason'] ?? ''),
            ],
            'clauses' => array_values(array_slice($clauses, 0, 8)),
            'legal' => array_values(array_slice($legal, 0, 6)),
            'external_regulations' => array_values(array_slice(array_filter($r['external_regulations'] ?? [], fn ($x) => ! empty($x['name'])), 0, 6)),
            'notes' => array_values(array_filter(array_map('strval', $r['notes'] ?? []))),
            'dropped_references' => $dropped,
        ];
    }

    private function cleanDraft(array $r, array $request): array
    {
        $clauseIndex = $this->clauseIndex();
        $legalIndex = $this->legalIndex();
        $dropped = 0;

        $sections = [];
        foreach ($r['sections'] ?? [] as $s) {
            $refs = [];
            foreach ($s['clause_refs'] ?? [] as $ref) {
                $key = trim(preg_replace('/\s+/', ' ', (string) $ref));
                if (isset($clauseIndex[$key])) {
                    $refs[] = $key;
                } else {
                    $dropped++;
                }
            }
            if (trim((string) ($s['heading'] ?? '')) === '') {
                continue;
            }
            $sections[] = ['heading' => (string) $s['heading'], 'content' => (string) ($s['content'] ?? ''), 'clause_refs' => array_values(array_unique($refs))];
        }

        // Pemetaan klausul → bagian, diturunkan dari referensi yang lolos validasi.
        $mapping = [];
        foreach ($sections as $s) {
            foreach ($s['clause_refs'] as $key) {
                $mapping[$key] ??= [...$clauseIndex[$key], 'sections' => []];
                $mapping[$key]['sections'][] = $s['heading'];
            }
        }

        $legal = [];
        foreach ($r['legal'] ?? [] as $l) {
            $row = $legalIndex->get($l['code'] ?? '');
            if ($row) {
                $legal[$row->code] = ['id' => $row->id, 'code' => $row->code, 'title' => $row->title, 'regulation_number' => $row->regulation_number, 'why' => (string) ($l['why'] ?? '')];
            } else {
                $dropped++;
            }
        }

        return [
            'request' => [
                'title' => $request['title'],
                'doc_type' => $request['doc_type'],
                'function_id' => $request['function_id'],
                'standards' => $request['standards'] ?? [],
            ],
            'purpose' => (string) ($r['purpose'] ?? ''),
            'scope' => (string) ($r['scope'] ?? ''),
            'sections' => $sections,
            'clause_mapping' => array_values($mapping),
            'legal' => array_values($legal),
            'review_notes' => array_values(array_filter(array_map('strval', $r['review_notes'] ?? []))),
            'dropped_references' => $dropped,
        ];
    }

    // ---------------------------------------------------------------- helpers

    private function hitLimit(User $user): ?string
    {
        $key = $this->limiterKey($user);
        if (RateLimiter::tooManyAttempts($key, self::HOURLY_LIMIT)) {
            $minutes = (int) ceil(RateLimiter::availableIn($key) / 60);

            return 'Batas '.self::HOURLY_LIMIT." permintaan AI per jam tercapai. Coba lagi dalam ± {$minutes} menit.";
        }
        RateLimiter::hit($key, 3600);

        return null;
    }

    private function limiterKey(User $user): string
    {
        return "ai-assistant:{$user->id}";
    }

    private function canRequest(User $user): bool
    {
        return $user->hasPermission(Permissions::DOCUMENT_REQUEST)
            || $user->hasPermission(Permissions::DOCUMENT_DRAFT)
            || $user->hasPermission(Permissions::DOCUMENT_CONTROL);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['message' => 'Anda tidak berwenang memakai Asisten AI.'], 403);
    }
}
