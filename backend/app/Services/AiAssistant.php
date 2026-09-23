<?php

namespace App\Services;

use Anthropic\Client;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APIStatusException;
use Anthropic\Core\Exceptions\AuthenticationException;
use Anthropic\Core\Exceptions\BadRequestException;
use Anthropic\Core\Exceptions\NotFoundException;
use Anthropic\Core\Exceptions\PermissionDeniedException;
use Anthropic\Core\Exceptions\RateLimitException;
use App\Models\AiGeneration;
use App\Models\IntegrationSetting;
use App\Models\User;
use GuzzleHttp\Client as GuzzleClient;
use Psr\Http\Client\ClientInterface;

/**
 * Pembungkus panggilan ke Claude API untuk modul Asisten AI.
 *
 * - Kunci API diambil dari Integration & API (tipe `ai`, tersimpan
 *   terenkripsi) — tidak pernah dari/ke frontend.
 * - Keluaran selalu JSON terstruktur (json_schema) supaya bisa divalidasi
 *   ulang di server: kode standar/klausul/regulasi yang tidak ada di master
 *   data dibuang oleh pemanggil, bukan ditampilkan sebagai fakta.
 * - Setiap panggilan dicatat di `ai_generations` (pemakaian token, untuk
 *   kendali biaya + KPI adopsi).
 * - Kegagalan dilempar sebagai AiUnavailable berpesan Bahasa Indonesia yang
 *   aman ditampilkan; detail teknis tidak bocor ke pengguna.
 */
class AiAssistant
{
    public const DEFAULT_MODEL = 'claude-opus-5';

    public const MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'];

    /** Beta header untuk server-side fallback saat model menolak karena kebijakan. */
    private const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

    public function setting(): IntegrationSetting
    {
        return IntegrationSetting::forType('ai');
    }

    public function configured(): bool
    {
        $setting = $this->setting();

        return $setting->enabled && ! empty($setting->secrets['api_key'] ?? null);
    }

    public function model(?IntegrationSetting $setting = null): string
    {
        $model = ($setting ?? $this->setting())->value('model');

        return in_array($model, self::MODELS, true) ? $model : self::DEFAULT_MODEL;
    }

    /**
     * Uji koneksi untuk halaman Integration & API: minta metadata model
     * terpilih — membuktikan kunci valid & model bisa diakses, tanpa
     * menghabiskan token.
     *
     * @return array{0: bool, 1: string}
     */
    public function testConnection(IntegrationSetting $setting): array
    {
        if (empty($setting->secrets['api_key'] ?? null)) {
            return [false, 'API Key wajib diisi & disimpan sebelum diuji.'];
        }

        $model = $this->model($setting);
        try {
            $info = $this->client($setting)->models->retrieve($model);

            return [true, "Terhubung. Model \"{$info->displayName}\" dapat diakses."];
        } catch (\Throwable $e) {
            return [false, $this->describe($e)];
        }
    }

    /**
     * Satu panggilan terstruktur. Mengembalikan [AiGeneration, array hasil].
     *
     * @param  array<string, mixed>  $schema  JSON Schema keluaran
     * @return array{0: AiGeneration, 1: array<string, mixed>}
     */
    public function generate(User $user, string $kind, string $subject, string $system, string $prompt, array $schema, string $effort, int $maxTokens): array
    {
        $setting = $this->setting();
        if (! $setting->enabled || empty($setting->secrets['api_key'] ?? null)) {
            throw new AiUnavailable('Asisten AI belum dikonfigurasi. Minta administrator mengisi & mengaktifkan integrasi "Asisten AI (Claude)" di menu Integration & API.');
        }

        $model = $this->model($setting);
        $client = $this->client($setting);
        $args = [
            'maxTokens' => $maxTokens,
            'model' => $model,
            'system' => $system,
            'messages' => [['role' => 'user', 'content' => $prompt]],
            'thinking' => ['type' => 'adaptive'],
            'outputConfig' => [
                'effort' => $effort,
                'format' => ['type' => 'json_schema', 'schema' => $schema],
            ],
            'fallbacks' => 'default',
            'betas' => [self::FALLBACK_BETA],
        ];

        try {
            try {
                $message = $client->beta->messages->create(...$args);
            } catch (BadRequestException $e) {
                // Bila model/akun tidak mendukung fallback server-side, ulangi
                // sekali tanpa opsi itu — jangan gagalkan fitur hanya karena opsi tambahan.
                if (! str_contains(strtolower($e->getMessage()), 'fallback')) {
                    throw $e;
                }
                unset($args['fallbacks'], $args['betas']);
                $message = $client->beta->messages->create(...$args);
            }
        } catch (\Throwable $e) {
            throw new AiUnavailable($this->describe($e), previous: $e);
        }

        if ($message->stopReason === 'refusal') {
            throw new AiUnavailable('Asisten AI menolak memproses permintaan ini. Ubah rumusan permintaan lalu coba lagi.');
        }
        if ($message->stopReason === 'max_tokens') {
            throw new AiUnavailable('Keluaran AI terpotong karena terlalu panjang. Persempit permintaan (mis. kurangi standar yang dipilih) lalu coba lagi.');
        }

        $text = null;
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                $text = $block->text;
                break;
            }
        }
        $data = is_string($text) ? json_decode($text, true) : null;
        if (! is_array($data)) {
            throw new AiUnavailable('Keluaran AI tidak bisa dibaca. Silakan coba lagi.');
        }

        $generation = AiGeneration::create([
            'user_id' => $user->id,
            'kind' => $kind,
            'subject' => mb_substr($subject, 0, 255),
            'model' => $message->model ?: $model,
            'input_tokens' => $message->usage->inputTokens,
            'output_tokens' => $message->usage->outputTokens,
            'result' => $data,
        ]);

        return [$generation, $data];
    }

    private function client(IntegrationSetting $setting): Client
    {
        // Transporter bisa diganti lewat container (dipakai tes agar tidak
        // pernah memanggil API sungguhan). Default: Guzzle dengan batas waktu
        // nyata — opsi `timeout` SDK hanya anjuran, transporter yang menegakkan.
        $transporter = app()->bound('ai.transporter')
            ? app('ai.transporter')
            : new GuzzleClient(['timeout' => 110, 'connect_timeout' => 10]);
        assert($transporter instanceof ClientInterface);

        return new Client(
            apiKey: (string) $setting->secrets['api_key'],
            requestOptions: ['maxRetries' => 1, 'transporter' => $transporter],
        );
    }

    private function describe(\Throwable $e): string
    {
        if ($e instanceof AiUnavailable) {
            return $e->getMessage();
        }
        report($e);

        return match (true) {
            $e instanceof AuthenticationException => 'API Key ditolak (tidak valid atau sudah dicabut). Periksa kembali di Integration & API.',
            $e instanceof PermissionDeniedException => 'API Key tidak punya akses ke model yang dipilih.',
            $e instanceof NotFoundException => 'Model yang dipilih tidak tersedia untuk API Key ini — pilih model lain di Integration & API.',
            $e instanceof RateLimitException => 'Batas pemakaian layanan AI sedang tercapai. Coba lagi beberapa saat lagi.',
            $e instanceof APIConnectionException => 'Tidak bisa terhubung ke layanan AI (jaringan/timeout). Coba lagi.',
            $e instanceof APIStatusException && ($e->status ?? 0) >= 500 => 'Layanan AI sedang bermasalah/sibuk. Coba lagi beberapa saat lagi.',
            $e instanceof APIStatusException => 'Permintaan ke layanan AI ditolak (HTTP '.($e->status ?? '?').').',
            default => 'Terjadi kesalahan saat menghubungi layanan AI.',
        };
    }
}
