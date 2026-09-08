<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NumberingSetting;
use App\Services\AuditLogger;
use App\Services\DocumentNumbering;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class NumberingSettingController extends Controller
{
    /** Jenis dokumen yang benar-benar dipakai DocumentController::store() — daftar type_codes tidak boleh melenceng dari ini. */
    private const KNOWN_TYPES = ['Kebijakan', 'Manual', 'SOP', 'Work Instruction', 'Formulir'];

    private const ALLOWED_TOKENS = ['{type}', '{function}', '{year}', '{yy}', '{seq}'];

    public function __construct(private AuditLogger $audit, private DocumentNumbering $numbering) {}

    public function show(Request $request): JsonResponse
    {
        if (! $request->user()->hasPermission(Permissions::MASTERDATA_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang melihat pengaturan penomoran.'], 403);
        }

        return response()->json($this->payload(NumberingSetting::current()));
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasPermission(Permissions::MASTERDATA_MANAGE)) {
            return response()->json(['message' => 'Anda tidak berwenang mengubah pengaturan penomoran.'], 403);
        }

        $data = $request->validate([
            'format' => ['required', 'string', 'max:100'],
            'seq_padding' => ['required', 'integer', 'min:1', 'max:8'],
            'type_codes' => ['required', 'array'],
            'type_codes.*' => ['required', 'string', 'max:10', 'regex:/^[A-Z0-9]+$/'],
        ], [
            'type_codes.*.regex' => 'Kode jenis dokumen hanya boleh huruf besar & angka.',
        ]);

        $this->validateFormat($data['format']);

        if (array_diff(self::KNOWN_TYPES, array_keys($data['type_codes']))
            || array_diff(array_keys($data['type_codes']), self::KNOWN_TYPES)) {
            throw ValidationException::withMessages([
                'type_codes' => 'Kode harus diisi untuk persis kelima jenis dokumen yang ada: '.implode(', ', self::KNOWN_TYPES).'.',
            ]);
        }

        $settings = NumberingSetting::current();
        $settings->format = $data['format'];
        $settings->seq_padding = $data['seq_padding'];
        $settings->type_codes = $data['type_codes'];
        $settings->updated_by = $user->id;
        $settings->save();

        $this->audit->log($user, 'update', 'NumberingSetting', '1', $settings->format,
            "Memperbarui formula penomoran dokumen menjadi \"{$settings->format}\".");

        return response()->json($this->payload($settings));
    }

    /** format WAJIB diakhiri "{seq}" — lihat catatan di DocumentNumbering. */
    private function validateFormat(string $format): void
    {
        $errors = [];

        if (! str_ends_with($format, '{seq}')) {
            $errors[] = 'Formula harus diakhiri dengan token {seq} (nomor urut harus di posisi paling akhir).';
        }

        $withoutKnownTokens = str_replace(self::ALLOWED_TOKENS, '', $format);
        if (str_contains($withoutKnownTokens, '{') || str_contains($withoutKnownTokens, '}')) {
            $errors[] = 'Token tidak dikenal. Token yang didukung: '.implode(', ', self::ALLOWED_TOKENS).'.';
        }

        if ($errors) {
            throw ValidationException::withMessages(['format' => $errors]);
        }
    }

    private function payload(NumberingSetting $settings): array
    {
        return [
            'format' => $settings->format,
            'seq_padding' => $settings->seq_padding,
            'type_codes' => (object) ($settings->type_codes ?: NumberingSetting::DEFAULT_TYPE_CODES),
            'known_types' => self::KNOWN_TYPES,
            'allowed_tokens' => self::ALLOWED_TOKENS,
            'preview' => $this->numbering->preview($settings),
        ];
    }
}
