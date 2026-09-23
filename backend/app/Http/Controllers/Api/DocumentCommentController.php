<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\Document;
use App\Models\DocumentComment;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Comment & Discussion. Siapa pun yang boleh MELIHAT dokumen boleh ikut
 * berdiskusi (DocumentPolicy::view). Notifikasi (mention, balasan,
 * komentar pada dokumen milik sendiri) hanya dikirim ke pengguna yang juga
 * boleh melihat dokumen itu — supaya notifikasi tidak menjadi jalur bocor
 * judul draft ke orang yang tidak berhak.
 */
class DocumentCommentController extends Controller
{
    public function __construct(private AuditLogger $audit) {}

    public function index(Request $request, Document $document): JsonResponse
    {
        $this->authorize('view', $document);

        $threads = DocumentComment::withTrashed()
            ->where('document_id', $document->id)->whereNull('parent_id')
            ->with(['author:id,name', 'resolver:id,name', 'mentions:id,name', 'replies.author:id,name', 'replies.mentions:id,name'])
            ->orderByDesc('created_at')->get()
            // Utas yang komentar utamanya dihapus DAN tanpa balasan tidak perlu ditampilkan lagi.
            ->reject(fn ($c) => $c->trashed() && $c->replies->isEmpty())->values();

        return response()->json([
            'threads' => $threads,
            'can_moderate' => $this->canModerate($request->user(), $document),
        ]);
    }

    public function store(Request $request, Document $document): JsonResponse
    {
        $this->authorize('view', $document);
        $user = $request->user();

        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'section' => ['nullable', 'string', 'max:120'],
            'parent_id' => ['nullable', 'integer'],
            'mentions' => ['sometimes', 'array', 'max:20'],
            'mentions.*' => ['integer', 'exists:users,id'],
        ]);

        $parent = null;
        if (! empty($data['parent_id'])) {
            $parent = DocumentComment::where('document_id', $document->id)->whereNull('parent_id')->find($data['parent_id']);
            if (! $parent) {
                return response()->json(['message' => 'Utas yang dibalas tidak ditemukan pada dokumen ini.'], 422);
            }
        }

        $comment = DB::transaction(function () use ($data, $document, $user, $parent) {
            $comment = DocumentComment::create([
                'document_id' => $document->id,
                'parent_id' => $parent?->id,
                'user_id' => $user->id,
                'section' => $parent ? null : ($data['section'] ?? null),
                'body' => $data['body'],
            ]);
            $comment->mentions()->sync(array_values(array_unique($data['mentions'] ?? [])));

            // Membalas utas yang sudah selesai membukanya kembali.
            if ($parent?->resolved_at) {
                $parent->update(['resolved_at' => null, 'resolved_by' => null]);
            }

            $this->notify($comment, $document, $user, $parent);

            return $comment;
        });

        $this->audit->log($user, 'create', 'DocumentComment', (string) $comment->id, $document->code,
            ($parent ? 'Membalas diskusi' : 'Memulai diskusi')." pada dokumen {$document->code}.");

        return response()->json($comment->load(['author:id,name', 'mentions:id,name']), 201);
    }

    public function update(Request $request, DocumentComment $comment): JsonResponse
    {
        $this->authorize('view', $comment->document);
        if ($comment->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Hanya penulis yang boleh menyunting komentarnya.'], 403);
        }

        $data = $request->validate(['body' => ['required', 'string', 'max:5000']]);
        $comment->update(['body' => $data['body'], 'edited_at' => now()]);

        return response()->json($comment->fresh()->load(['author:id,name', 'mentions:id,name']));
    }

    public function destroy(Request $request, DocumentComment $comment): JsonResponse
    {
        $document = $comment->document;
        $this->authorize('view', $document);
        $user = $request->user();
        if ($comment->user_id !== $user->id && ! $user->hasPermission(Permissions::DOCUMENT_CONTROL)) {
            return response()->json(['message' => 'Anda tidak berwenang menghapus komentar ini.'], 403);
        }

        $comment->delete();
        $this->audit->log($user, 'delete', 'DocumentComment', (string) $comment->id, $document->code,
            "Menghapus komentar diskusi pada dokumen {$document->code}.");

        return response()->json(['deleted' => true]);
    }

    public function resolve(Request $request, DocumentComment $comment): JsonResponse
    {
        $document = $comment->document;
        $this->authorize('view', $document);
        $user = $request->user();

        if ($comment->parent_id) {
            return response()->json(['message' => 'Yang ditandai selesai adalah utas, bukan balasannya.'], 422);
        }
        if ($comment->user_id !== $user->id && ! $this->canModerate($user, $document)) {
            return response()->json(['message' => 'Hanya pembuka utas, pemilik dokumen, atau Document Controller yang boleh menandai selesai.'], 403);
        }

        $data = $request->validate(['resolved' => ['required', 'boolean']]);
        $comment->update($data['resolved']
            ? ['resolved_at' => now(), 'resolved_by' => $user->id]
            : ['resolved_at' => null, 'resolved_by' => null]);

        return response()->json($comment->fresh()->load(['resolver:id,name']));
    }

    /** Kotak masuk diskusi lintas dokumen yang boleh dilihat pengguna. */
    public function inbox(Request $request): JsonResponse
    {
        $user = $request->user();
        $filter = $request->string('filter')->toString();

        $query = DocumentComment::query()->whereNull('parent_id')
            ->whereHas('document', fn ($q) => $q->visibleTo($user))
            ->with(['author:id,name', 'resolver:id,name', 'document:id,code,title,status,owner_id'])
            ->withCount('replies');

        match ($filter) {
            'resolved' => $query->whereNotNull('resolved_at'),
            'mentions' => $query->where(fn ($q) => $q
                ->whereHas('mentions', fn ($m) => $m->whereKey($user->id))
                ->orWhereHas('replies', fn ($r) => $r->whereHas('mentions', fn ($m) => $m->whereKey($user->id)))),
            'mine' => $query->where(fn ($q) => $q
                ->where('user_id', $user->id)
                ->orWhereHas('document', fn ($d) => $d->where('owner_id', $user->id))),
            default => $query->whereNull('resolved_at'),
        };

        return response()->json([
            'threads' => $query->orderByDesc('updated_at')->limit(100)->get(),
            'counts' => [
                'open' => DocumentComment::whereNull('parent_id')->whereNull('resolved_at')->whereHas('document', fn ($q) => $q->visibleTo($user))->count(),
                'mentions' => DocumentComment::whereHas('mentions', fn ($m) => $m->whereKey($user->id))->whereHas('document', fn ($q) => $q->visibleTo($user))->count(),
            ],
        ]);
    }

    private function notify(DocumentComment $comment, Document $document, User $author, ?DocumentComment $parent): void
    {
        $recipients = [];
        foreach ($comment->mentions as $u) {
            $recipients[$u->id] = ['comment_mention', "{$author->name} menyebut Anda di diskusi {$document->code}"];
        }
        if ($parent && ! isset($recipients[$parent->user_id])) {
            $recipients[$parent->user_id] = ['comment_reply', "{$author->name} membalas diskusi Anda di {$document->code}"];
        }
        if ($document->owner_id && ! isset($recipients[$document->owner_id])) {
            $recipients[$document->owner_id] = ['comment_on_document', "Diskusi baru pada dokumen Anda {$document->code}"];
        }
        unset($recipients[$author->id]);

        $users = User::whereIn('id', array_keys($recipients))->where('active', true)->with('roles:id')->get();
        foreach ($users as $u) {
            if (! $u->can('view', $document)) {
                continue;
            }
            [$type, $title] = $recipients[$u->id];
            AppNotification::create([
                'user_id' => $u->id,
                'type' => $type,
                'title' => $title,
                'body' => mb_strimwidth($comment->body, 0, 160, '…'),
                'link' => "/documents/{$document->id}#diskusi",
            ]);
        }
    }

    private function canModerate(User $user, Document $document): bool
    {
        return $document->owner_id === $user->id || $user->hasPermission(Permissions::DOCUMENT_CONTROL);
    }
}
