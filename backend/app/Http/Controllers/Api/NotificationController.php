<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Pusat Notifikasi dalam-aplikasi. Hanya notifikasi pribadi (user_id =
 * pengguna ini) yang punya status baca; pengumuman umum (user_id null)
 * belum dipakai modul mana pun, jadi tidak ikut dihitung "belum dibaca".
 */
class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        return response()->json([
            'notifications' => AppNotification::visibleTo($userId)->latest()->limit(30)->get(),
            'unread' => AppNotification::where('user_id', $userId)->unread()->count(),
        ]);
    }

    public function read(Request $request, AppNotification $notification): JsonResponse
    {
        abort_unless($notification->user_id === $request->user()->id, 404);
        $notification->update(['read_at' => $notification->read_at ?? now()]);

        return response()->json($notification);
    }

    public function readAll(Request $request): JsonResponse
    {
        $count = AppNotification::where('user_id', $request->user()->id)->unread()->update(['read_at' => now()]);

        return response()->json(['marked' => $count]);
    }
}
