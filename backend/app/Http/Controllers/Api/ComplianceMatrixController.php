<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Standard;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Compliance Matrix — untuk tiap standar acuan aktif (ISO 9001, ISO 45001,
 * dst.), tampilkan dokumen mana yang menyatakan memenuhinya (lihat relasi
 * document_standard, ditandai lewat form Buat/Ubah Dokumen) dan apakah ada
 * yang RESMI TERBIT (released) — bukan cuma draft — karena hanya dokumen
 * released yang benar-benar berlaku sebagai bukti kepatuhan. Standar tanpa
 * satu pun dokumen released adalah GAP yang perlu perhatian compliance
 * admin/manajemen.
 *
 * Sengaja hanya baca — penandaan standar pada dokumen sudah dilakukan di
 * form dokumen (DocumentController), bukan diulang di sini.
 */
class ComplianceMatrixController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::REPORTING_VIEW)) {
            return response()->json([
                'message' => 'Anda tidak berwenang melihat Compliance Matrix.',
            ], 403);
        }

        $standards = Standard::where('active', true)
            ->orderBy('code')
            ->with(['documents' => function ($query) {
                $query->select('documents.id', 'documents.code', 'documents.title', 'documents.status', 'documents.classification', 'documents.function_id')
                    ->with('orgFunction:id,name')
                    ->orderBy('documents.code');
            }])
            ->get();

        $rows = $standards->map(function (Standard $standard) {
            $releasedCount = $standard->documents->where('status', 'released')->count();

            return [
                'code' => $standard->code,
                'name' => $standard->name,
                'documents_count' => $standard->documents->count(),
                'released_count' => $releasedCount,
                'has_gap' => $releasedCount === 0,
                'documents' => $standard->documents->values(),
            ];
        });

        return response()->json([
            'standards' => $rows->values(),
            'summary' => [
                'total_standards' => $rows->count(),
                'covered' => $rows->where('has_gap', false)->count(),
                'gaps' => $rows->where('has_gap', true)->pluck('code')->values(),
            ],
        ]);
    }
}
