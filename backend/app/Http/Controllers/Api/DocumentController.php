<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\DocumentRevision;
use App\Services\AuditLogger;
use App\Services\DocumentLifecycle;
use App\Services\DocumentNumbering;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

class DocumentController extends Controller
{
    public function __construct(
        private AuditLogger $audit,
        private DocumentNumbering $numbering,
        private DocumentLifecycle $lifecycle,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Document::query()
            ->with(['orgFunction:id,name', 'owner:id,name', 'standards:code,name'])
            ->withCount('files');

        // Pengguna yang tidak terlibat siklus dokumen hanya boleh melihat
        // dokumen yang sudah Released. Disaring di SQL, bukan di frontend.
        if (! $this->involvedInLifecycle($request)) {
            $query->where('status', 'released');
        }

        foreach (['status', 'type', 'function_id', 'classification'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->string($filter));
            }
        }

        if ($request->filled('standard')) {
            $query->whereHas('standards', fn ($q) => $q->where('code', $request->string('standard')));
        }

        if ($request->filled('q')) {
            $term = '%'.$request->string('q').'%';
            $query->where(fn ($q) => $q->where('title', 'like', $term)->orWhere('code', 'like', $term));
        }

        if ($request->boolean('due_for_review')) {
            $query->dueForReview(now()->addDays((int) $request->integer('within_days', 30))->toDateString());
        }

        return response()->json(
            $query->orderByDesc('updated_at')->paginate((int) $request->integer('per_page', 25))
        );
    }

    public function show(Request $request, Document $document): JsonResponse
    {
        $this->authorize('view', $document);

        $document->load([
            'orgFunction:id,name', 'owner:id,name', 'creator:id,name',
            'standards:code,name', 'revisions.editor:id,name',
            'files.uploader:id,name', 'documentRelations.target:id,code,title,status',
        ]);

        return response()->json([
            'document' => $document,
            'allowed_next' => $this->lifecycle->allowedNext($document->status),
            'can' => [
                'update' => $request->user()->can('update', $document),
                'transition' => $request->user()->can('transition', $document),
                'upload_file' => $request->user()->can('uploadFile', $document),
                'delete' => $request->user()->can('delete', $document),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Document::class);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(['Kebijakan', 'Manual', 'SOP', 'Work Instruction', 'Formulir'])],
            'function_id' => ['required', 'exists:org_functions,id'],
            'classification' => ['required', Rule::in(['public', 'internal', 'restricted', 'confidential', 'secret', 'top_secret'])],
            'standards' => ['array'],
            'standards.*' => ['string', 'exists:standards,code'],
            'keywords' => ['array'],
            'keywords.*' => ['string', 'max:64'],
            'content' => ['nullable', 'string'],
            'owner_id' => ['nullable', 'exists:users,id'],
        ]);

        $user = $request->user();

        $document = DB::transaction(function () use ($data, $user) {
            $document = Document::create([
                'code' => $this->numbering->nextCode($data['type'], $data['function_id']),
                'title' => $data['title'],
                'type' => $data['type'],
                'function_id' => $data['function_id'],
                'classification' => $data['classification'],
                'status' => 'draft',
                'validity' => 'belum_berlaku',
                'version' => '1.0',
                'revision_number' => 0,
                'keywords' => $data['keywords'] ?? [],
                'content' => $data['content'] ?? null,
                'owner_id' => $data['owner_id'] ?? $user->id,
                'created_by' => $user->id,
            ]);

            $document->standards()->sync($data['standards'] ?? []);

            DocumentRevision::create([
                'document_id' => $document->id,
                'revision_number' => 0,
                'version' => '1.0',
                'date' => now()->toDateString(),
                'editor_id' => $user->id,
                'editor_name' => $user->name,
                'notes' => 'Dokumen dibuat',
                'status' => 'draft',
                'content_snapshot' => $document->content,
            ]);

            $this->audit->log($user, 'create', 'Document', (string) $document->id, $document->code,
                "Membuat dokumen \"{$document->title}\" ({$document->code})");

            return $document;
        });

        return response()->json($document->load('standards:code,name'), 201);
    }

    public function update(Request $request, Document $document): JsonResponse
    {
        $this->authorize('update', $document);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'classification' => ['sometimes', Rule::in(['public', 'internal', 'restricted', 'confidential', 'secret', 'top_secret'])],
            'standards' => ['sometimes', 'array'],
            'standards.*' => ['string', 'exists:standards,code'],
            'keywords' => ['sometimes', 'array'],
            'keywords.*' => ['string', 'max:64'],
            'content' => ['sometimes', 'nullable', 'string'],
            'owner_id' => ['sometimes', 'nullable', 'exists:users,id'],
            'review_date' => ['sometimes', 'nullable', 'date'],
            'expiry_date' => ['sometimes', 'nullable', 'date'],
        ]);

        $document->fill(collect($data)->except('standards')->all())->save();

        if (array_key_exists('standards', $data)) {
            $document->standards()->sync($data['standards']);
        }

        $this->audit->log($request->user(), 'update', 'Document', (string) $document->id, $document->code,
            'Memperbarui metadata dokumen: '.implode(', ', array_keys($data)));

        return response()->json($document->fresh()->load('standards:code,name'));
    }

    public function transition(Request $request, Document $document): JsonResponse
    {
        $this->authorize('transition', $document);

        $data = $request->validate([
            'to_status' => ['required', 'string'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $document = $this->lifecycle->transition($document, $data['to_status'], $request->user(), $data['note'] ?? null);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'document' => $document->fresh(),
            'allowed_next' => $this->lifecycle->allowedNext($document->status),
        ]);
    }

    private function involvedInLifecycle(Request $request): bool
    {
        $user = $request->user();
        foreach ([
            Permissions::DOCUMENT_DRAFT, Permissions::DOCUMENT_REVIEW,
            Permissions::DOCUMENT_APPROVE, Permissions::DOCUMENT_CONTROL,
            Permissions::DOCUMENT_RATIFY, Permissions::AUDIT_VIEW,
        ] as $permission) {
            if ($user->hasPermission($permission)) {
                return true;
            }
        }

        return false;
    }
}
