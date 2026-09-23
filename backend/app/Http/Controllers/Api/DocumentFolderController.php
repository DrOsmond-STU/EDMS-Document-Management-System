<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\DocumentFolder;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Folder Virtual & Kategori. Struktur folder/kategori terlihat oleh semua
 * pengguna, tapi dokumen di dalamnya SELALU disaring dengan aturan
 * visibilitas yang sama dengan Register Dokumen (Document::visibleTo),
 * termasuk angka jumlah dokumennya — supaya jumlah pun tidak membocorkan
 * keberadaan draft. Hanya Document Controller / admin master data yang
 * boleh menyusun folder & kategori.
 *
 * Menghapus folder/kategori tidak pernah menyentuh dokumennya — hanya
 * pengelompokannya yang hilang.
 */
class DocumentFolderController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    // ---- Folder ---------------------------------------------------------

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'folders' => DocumentFolder::withCount(['documents' => fn ($q) => $q->visibleTo($user)])
                ->orderBy('name')->get(),
            'categories' => DocumentCategory::withCount(['documents' => fn ($q) => $q->visibleTo($user)])
                ->orderBy('name')->get(),
            'can_manage' => $this->canManage($request),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->canManage($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'parent_id' => ['nullable', 'integer', 'exists:document_folders,id'],
            'description' => ['nullable', 'string', 'max:255'],
        ]);
        if ($this->nameTaken($data['name'], $data['parent_id'] ?? null)) {
            return response()->json(['message' => 'Sudah ada folder dengan nama itu di lokasi yang sama.'], 422);
        }

        $folder = DocumentFolder::create([...$data, 'created_by' => $request->user()->id]);

        $this->audit->log($request->user(), 'create', 'DocumentFolder', (string) $folder->id, $folder->name,
            "Membuat folder virtual \"{$folder->name}\".");

        return response()->json($folder->loadCount('documents'), 201);
    }

    public function update(Request $request, DocumentFolder $folder): JsonResponse
    {
        if (! $this->canManage($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'parent_id' => ['sometimes', 'nullable', 'integer', 'exists:document_folders,id'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        if (array_key_exists('parent_id', $data) && $data['parent_id'] !== null && $folder->isSelfOrDescendant((int) $data['parent_id'])) {
            return response()->json(['message' => 'Folder tidak bisa dipindah ke dalam dirinya sendiri atau subfoldernya.'], 422);
        }
        $name = $data['name'] ?? $folder->name;
        $parent = array_key_exists('parent_id', $data) ? $data['parent_id'] : $folder->parent_id;
        if ($this->nameTaken($name, $parent, $folder->id)) {
            return response()->json(['message' => 'Sudah ada folder dengan nama itu di lokasi yang sama.'], 422);
        }

        $folder->fill($data)->save();

        $this->audit->log($request->user(), 'update', 'DocumentFolder', (string) $folder->id, $folder->name,
            "Memperbarui folder virtual \"{$folder->name}\".");

        return response()->json($folder->fresh()->loadCount('documents'));
    }

    public function destroy(Request $request, DocumentFolder $folder): JsonResponse
    {
        if (! $this->canManage($request)) {
            return $this->forbidden();
        }
        if ($folder->children()->exists()) {
            return response()->json(['message' => 'Kosongkan atau pindahkan subfolder terlebih dahulu.'], 422);
        }

        $name = $folder->name;
        $folder->delete(); // dokumen tidak tersentuh — hanya baris pengelompokannya (cascade)

        $this->audit->log($request->user(), 'delete', 'DocumentFolder', (string) $folder->id, $name,
            "Menghapus folder virtual \"{$name}\" (dokumen di dalamnya tidak terpengaruh).");

        return response()->json(['deleted' => true]);
    }

    public function documents(Request $request, DocumentFolder $folder): JsonResponse
    {
        return response()->json([
            'documents' => $this->documentList($request, $folder->documents()),
        ]);
    }

    public function addDocuments(Request $request, DocumentFolder $folder): JsonResponse
    {
        if (! $this->canManage($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'document_ids' => ['required', 'array', 'min:1', 'max:200'],
            'document_ids.*' => ['integer', 'exists:documents,id'],
        ]);

        $ids = Document::visibleTo($request->user())->whereIn('id', $data['document_ids'])->pluck('id');
        $folder->documents()->syncWithoutDetaching(
            $ids->mapWithKeys(fn ($id) => [$id => ['added_by' => $request->user()->id, 'created_at' => now()]])->all()
        );

        $this->audit->log($request->user(), 'update', 'DocumentFolder', (string) $folder->id, $folder->name,
            "Menambahkan {$ids->count()} dokumen ke folder virtual \"{$folder->name}\".");

        return response()->json(['added' => $ids->count()]);
    }

    public function removeDocument(Request $request, DocumentFolder $folder, Document $document): JsonResponse
    {
        if (! $this->canManage($request)) {
            return $this->forbidden();
        }

        $folder->documents()->detach($document->id);

        $this->audit->log($request->user(), 'update', 'DocumentFolder', (string) $folder->id, $folder->name,
            "Mengeluarkan dokumen {$document->code} dari folder virtual \"{$folder->name}\".");

        return response()->json(['removed' => true]);
    }

    // ---- Kategori -------------------------------------------------------

    public function storeCategory(Request $request): JsonResponse
    {
        if (! $this->canManage($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:60', 'unique:document_categories,name'],
            'color' => ['sometimes', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);
        $category = DocumentCategory::create($data);

        $this->audit->log($request->user(), 'create', 'DocumentCategory', (string) $category->id, $category->name,
            "Membuat kategori dokumen \"{$category->name}\".");

        return response()->json($category->loadCount('documents'), 201);
    }

    public function updateCategory(Request $request, DocumentCategory $category): JsonResponse
    {
        if (! $this->canManage($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:60', Rule::unique('document_categories', 'name')->ignore($category->id)],
            'color' => ['sometimes', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);
        $category->update($data);

        $this->audit->log($request->user(), 'update', 'DocumentCategory', (string) $category->id, $category->name,
            "Memperbarui kategori dokumen \"{$category->name}\".");

        return response()->json($category->fresh()->loadCount('documents'));
    }

    public function destroyCategory(Request $request, DocumentCategory $category): JsonResponse
    {
        if (! $this->canManage($request)) {
            return $this->forbidden();
        }

        $name = $category->name;
        $category->delete();

        $this->audit->log($request->user(), 'delete', 'DocumentCategory', (string) $category->id, $name,
            "Menghapus kategori dokumen \"{$name}\" (dokumennya tidak terpengaruh).");

        return response()->json(['deleted' => true]);
    }

    public function categoryDocuments(Request $request, DocumentCategory $category): JsonResponse
    {
        return response()->json([
            'documents' => $this->documentList($request, $category->documents()),
        ]);
    }

    public function syncDocumentCategories(Request $request, Document $document): JsonResponse
    {
        if (! $this->canManage($request)) {
            return $this->forbidden();
        }

        $data = $request->validate([
            'category_ids' => ['present', 'array'],
            'category_ids.*' => ['integer', 'exists:document_categories,id'],
        ]);
        $document->categories()->sync($data['category_ids']);

        $this->audit->log($request->user(), 'update', 'Document', $document->code, $document->title,
            "Mengatur kategori dokumen {$document->code}.");

        return response()->json(['categories' => $document->categories()->orderBy('name')->get()]);
    }

    // ---- Helper ---------------------------------------------------------

    private function documentList(Request $request, $relation)
    {
        $query = $relation->visibleTo($request->user())
            ->with(['orgFunction:id,name', 'categories:id,name,color'])
            ->select('documents.id', 'documents.code', 'documents.title', 'documents.type', 'documents.status',
                'documents.validity', 'documents.version', 'documents.function_id', 'documents.review_date');

        if ($q = trim((string) $request->string('q'))) {
            $query->where(fn ($w) => $w->where('documents.title', 'like', "%{$q}%")->orWhere('documents.code', 'like', "%{$q}%"));
        }

        return $query->orderBy('documents.code')->get();
    }

    private function nameTaken(string $name, ?int $parentId, ?int $exceptId = null): bool
    {
        return DocumentFolder::where('name', $name)
            ->where(fn ($q) => $parentId === null ? $q->whereNull('parent_id') : $q->where('parent_id', $parentId))
            ->when($exceptId, fn ($q) => $q->whereKeyNot($exceptId))
            ->exists();
    }

    private function canManage(Request $request): bool
    {
        return $request->user()->hasPermission(Permissions::DOCUMENT_CONTROL)
            || $request->user()->hasPermission(Permissions::MASTERDATA_MANAGE);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['message' => 'Hanya Document Controller/admin yang boleh menyusun folder & kategori.'], 403);
    }
}
