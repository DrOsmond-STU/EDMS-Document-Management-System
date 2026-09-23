<?php

namespace Tests\Feature;

use App\Models\AiGeneration;
use App\Models\Document;
use App\Models\IntegrationSetting;
use App\Models\LegalRequirement;
use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\Standard;
use App\Models\StandardClause;
use App\Models\User;
use App\Services\LicenseService;
use GuzzleHttp\Psr7\Response;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use Tests\TestCase;

class AiAssistantTest extends TestCase
{
    use RefreshDatabase;

    private const KEY = 'sk-ant-test-rahasia-1234567890';

    /** @var list<RequestInterface> */
    private array $sent = [];

    /** @var list<ResponseInterface> */
    private array $queue = [];

    protected function setUp(): void
    {
        parent::setUp();

        $test = $this;
        $this->app->instance('ai.transporter', new class($test) implements ClientInterface
        {
            public function __construct(private AiAssistantTest $test) {}

            public function sendRequest(RequestInterface $request): ResponseInterface
            {
                return $this->test->handle($request);
            }
        });

        $this->activateLicense();
        OrgFunction::create(['id' => 'hse', 'name' => 'HSE', 'active' => true]);
        OrgFunction::create(['id' => 'qa', 'name' => 'Quality Assurance', 'active' => true]);
        Standard::create(['code' => 'ISO45001', 'name' => 'ISO 45001:2018', 'active' => true]);
        Standard::create(['code' => 'ISO9001', 'name' => 'ISO 9001:2015', 'active' => true]);
        StandardClause::create(['standard_code' => 'ISO45001', 'code' => '8.2', 'title' => 'Kesiapsiagaan & Tanggap Darurat', 'sort_order' => 1]);
        StandardClause::create(['standard_code' => 'ISO9001', 'code' => '7.5', 'title' => 'Informasi Terdokumentasi', 'sort_order' => 1]);
        LegalRequirement::create(['code' => 'LEG-0001', 'title' => 'Keselamatan Kerja', 'regulation_number' => 'UU 1/1970', 'regulation_type' => 'UU', 'category' => 'K3', 'status' => 'active', 'function_id' => 'hse']);
    }

    public function handle(RequestInterface $request): ResponseInterface
    {
        $this->sent[] = $request;

        return array_shift($this->queue) ?? new Response(500, [], '{"type":"error","error":{"type":"api_error","message":"no fake"}}');
    }

    private function queueMessage(array $payload, string $stopReason = 'end_turn'): void
    {
        $this->queue[] = new Response(200, ['Content-Type' => 'application/json'], json_encode([
            'id' => 'msg_test', 'type' => 'message', 'role' => 'assistant', 'model' => 'claude-opus-5',
            'content' => [['type' => 'text', 'text' => json_encode($payload)]],
            'stop_reason' => $stopReason, 'stop_sequence' => null,
            'usage' => ['input_tokens' => 1200, 'output_tokens' => 340],
        ]));
    }

    private function activateLicense(): void
    {
        $service = app(LicenseService::class);
        $expires = now()->addYear()->toDateString();
        $signature = $service->computeSignature('EDMS-TEST-0001', $expires, 'active', 'PT Uji', '');
        $this->postJson('/api/license/apply', [
            'license_key' => 'EDMS-TEST-0001', 'expires_at' => $expires, 'status' => 'active',
            'company_name' => 'PT Uji', 'signature' => $signature,
        ])->assertOk();
    }

    private function makeUser(string $roleId, ?string $email = null): User
    {
        Role::firstOrCreate(['id' => $roleId], ['label' => ucfirst($roleId)]);
        $user = User::create([
            'name' => 'Pengguna '.$roleId, 'email' => $email ?? $roleId.'@example.com', 'password' => 'rahasia-panjang-sekali',
            'active' => true, 'must_change_password' => false,
        ]);
        $user->roles()->attach($roleId);

        return $user;
    }

    private function configure(): void
    {
        $setting = IntegrationSetting::forType('ai');
        $setting->update(['enabled' => true, 'config' => ['model' => 'claude-opus-5'], 'secrets' => ['api_key' => self::KEY]]);
    }

    private function doc(string $code, string $title, array $keywords = []): Document
    {
        return Document::create([
            'code' => $code, 'title' => $title, 'type' => 'SOP', 'function_id' => 'hse', 'classification' => 'internal',
            'status' => 'released', 'validity' => 'berlaku', 'version' => '1.0', 'revision_number' => 0, 'keywords' => $keywords,
        ]);
    }

    public function test_discover_without_configuration_still_returns_deterministic_matches(): void
    {
        $this->doc('SOP-HSE-001', 'Prosedur Tanggap Darurat Kebakaran', ['darurat', 'kebakaran']);
        $this->doc('SOP-HSE-002', 'Prosedur Izin Kerja Panas');

        $res = $this->actingAs($this->makeUser('requester'))
            ->postJson('/api/ai/discover', ['topic' => 'Prosedur tanggap darurat kebakaran gudang'])
            ->assertOk()
            ->assertJsonPath('ai', null);

        $this->assertStringContainsString('belum dikonfigurasi', $res->json('ai_error'));
        $this->assertSame('SOP-HSE-001', $res->json('matches.0.code'));
        $this->assertTrue($res->json('matches.0.likely_duplicate'));
        $this->assertCount(0, $this->sent, 'Tanpa konfigurasi tidak boleh ada panggilan ke layanan AI.');
    }

    public function test_discover_calls_claude_and_drops_references_not_in_master_data(): void
    {
        $this->configure();
        $this->doc('SOP-HSE-001', 'Prosedur Tanggap Darurat Kebakaran');
        $this->queueMessage([
            'summary' => 'Kebutuhan sudah sebagian tercakup.',
            'recommendation' => ['action' => 'revisi_dokumen_ada', 'document_code' => 'SOP-HSE-001', 'reason' => 'Perluas ruang lingkup.'],
            'proposed' => ['title' => 'Prosedur Tanggap Darurat', 'doc_type' => 'SOP', 'function_id' => 'hse', 'standards' => ['ISO45001', 'ISO99999'], 'reason' => 'x'],
            'clauses' => [
                ['standard' => 'ISO45001', 'clause' => '8.2', 'why' => 'Tanggap darurat'],
                ['standard' => 'ISO45001', 'clause' => '99.9', 'why' => 'karangan'],
            ],
            'legal' => [['code' => 'LEG-0001', 'why' => 'K3'], ['code' => 'LEG-9999', 'why' => 'karangan']],
            'external_regulations' => [['name' => 'Permenaker 4/1980', 'why' => 'APAR']],
            'notes' => ['Verifikasi titik kumpul.'],
        ]);

        $res = $this->actingAs($this->makeUser('requester'))
            ->postJson('/api/ai/discover', ['topic' => 'Prosedur tanggap darurat kebakaran'])
            ->assertOk();

        $this->assertNull($res->json('ai_error'));
        $this->assertSame('revisi_dokumen_ada', $res->json('ai.recommendation.action'));
        $this->assertSame('SOP-HSE-001', $res->json('ai.recommendation.document_code'));
        $this->assertSame(['ISO45001'], $res->json('ai.proposed.standards'));
        $this->assertCount(1, $res->json('ai.clauses'));
        $this->assertSame('Kesiapsiagaan & Tanggap Darurat', $res->json('ai.clauses.0.title'));
        $this->assertSame(['LEG-0001'], array_column($res->json('ai.legal'), 'code'));
        $this->assertSame(2, $res->json('ai.dropped_references'));
        $this->assertStringNotContainsString(self::KEY, $res->getContent());

        // Permintaan ke API: model, adaptive thinking, keluaran terstruktur, fallback server-side.
        $this->assertCount(1, $this->sent);
        $request = $this->sent[0];
        $this->assertStringEndsWith('/v1/messages', $request->getUri()->getPath());
        $this->assertSame(self::KEY, $request->getHeaderLine('x-api-key'));
        $this->assertStringContainsString('server-side-fallback', $request->getHeaderLine('anthropic-beta'));
        $body = json_decode((string) $request->getBody(), true);
        $this->assertSame('claude-opus-5', $body['model']);
        $this->assertSame('adaptive', $body['thinking']['type']);
        $this->assertSame('json_schema', $body['output_config']['format']['type']);
        $this->assertSame('low', $body['output_config']['effort']);
        $this->assertSame('default', $body['fallbacks']);
        $this->assertStringContainsString('SOP-HSE-001', $body['messages'][0]['content']);

        $generation = AiGeneration::sole();
        $this->assertSame('discover', $generation->kind);
        $this->assertSame(1200, $generation->input_tokens);
        $this->assertSame(340, $generation->output_tokens);
    }

    public function test_discover_never_leaks_documents_the_user_cannot_see(): void
    {
        $this->configure();
        Document::create([
            'code' => 'SOP-HSE-009', 'title' => 'Prosedur Tanggap Darurat Rahasia', 'type' => 'SOP', 'function_id' => 'hse',
            'classification' => 'internal', 'status' => 'draft', 'validity' => 'belum_berlaku', 'version' => '0.1', 'revision_number' => 0,
        ]);
        $this->queueMessage([
            'summary' => 's', 'recommendation' => ['action' => 'revisi_dokumen_ada', 'document_code' => 'SOP-HSE-009', 'reason' => 'r'],
            'proposed' => ['title' => 't', 'doc_type' => 'SOP', 'function_id' => 'hse', 'standards' => [], 'reason' => 'r'],
            'clauses' => [], 'legal' => [], 'external_regulations' => [], 'notes' => [],
        ]);

        $res = $this->actingAs($this->makeUser('requester'))
            ->postJson('/api/ai/discover', ['topic' => 'Prosedur tanggap darurat'])->assertOk();

        $this->assertSame([], $res->json('matches'));
        $this->assertStringNotContainsString('SOP-HSE-009', json_decode((string) $this->sent[0]->getBody(), true)['messages'][0]['content']);
        // Kode dokumen yang tidak ada di kandidat (tidak terlihat) dibuang.
        $this->assertSame('', $res->json('ai.recommendation.document_code'));
        $this->assertNull($res->json('ai.recommendation.document_id'));
    }

    public function test_draft_then_create_drafting_request_marks_generation_followed_up(): void
    {
        $this->configure();
        $this->queueMessage([
            'purpose' => 'Menetapkan langkah tanggap darurat.',
            'scope' => 'Seluruh area kerja.',
            'sections' => [
                ['heading' => 'Tanggung Jawab', 'content' => 'Tim tanggap darurat…', 'clause_refs' => ['ISO45001 8.2', 'ISO45001 12.1']],
                ['heading' => 'Pengendalian Dokumen', 'content' => 'Rekaman disimpan…', 'clause_refs' => ['ISO9001 7.5']],
            ],
            'legal' => [['code' => 'LEG-0001', 'why' => 'K3']],
            'review_notes' => ['Isi nomor telepon darurat.'],
        ]);
        $user = $this->makeUser('requester');

        $res = $this->actingAs($user)->postJson('/api/ai/draft', [
            'title' => 'Prosedur Tanggap Darurat', 'doc_type' => 'SOP', 'function_id' => 'hse', 'standards' => ['ISO45001', 'ISO9001'],
        ])->assertOk();

        $this->assertSame(['ISO45001 8.2'], $res->json('sections.0.clause_refs'));
        $this->assertSame(1, $res->json('dropped_references'));
        $this->assertSame(['ISO45001 8.2', 'ISO9001 7.5'], array_map(fn ($m) => "{$m['standard']} {$m['clause']}", $res->json('clause_mapping')));
        $this->assertSame('medium', json_decode((string) $this->sent[0]->getBody(), true)['output_config']['effort']);

        $generationId = $res->json('generation_id');
        $project = $this->actingAs($user)->postJson('/api/drafting-projects', [
            'title' => 'Prosedur Tanggap Darurat', 'doc_type' => 'SOP', 'function_id' => 'hse', 'classification' => 'internal',
            'reason' => 'Dari Asisten AI', 'standards' => ['ISO45001'], 'ai_generation_id' => $generationId,
        ])->assertCreated();

        $code = $project->json('project.code') ?? $project->json('code');
        $generation = AiGeneration::find($generationId);
        $this->assertNotNull($generation->followed_up_at);
        $this->assertSame($code, $generation->followed_up_ref);
        $this->assertStringContainsString('1. TUJUAN', \App\Models\DraftingProject::where('code', $code)->value('final_content'));
    }

    public function test_generation_of_another_user_is_not_used_or_marked(): void
    {
        $owner = $this->makeUser('requester');
        $generation = AiGeneration::create(['user_id' => $owner->id, 'kind' => 'draft', 'subject' => 'x', 'model' => 'claude-opus-5',
            'result' => ['request' => ['title' => 'Rahasia'], 'purpose' => 'RAHASIA', 'sections' => []]]);
        $other = $this->makeUser('drafter');

        $res = $this->actingAs($other)->postJson('/api/drafting-projects', [
            'title' => 'Lain', 'doc_type' => 'SOP', 'function_id' => 'hse', 'classification' => 'internal',
            'reason' => 'x', 'ai_generation_id' => $generation->id,
        ])->assertCreated();

        $this->assertNull($generation->fresh()->followed_up_at);
        $this->assertStringNotContainsString('RAHASIA', (string) \App\Models\DraftingProject::latest('id')->value('final_content'));
        $this->actingAs($other)->getJson("/api/ai/generations/{$generation->id}")->assertForbidden();
    }

    public function test_refusal_and_truncation_are_reported_without_storing(): void
    {
        $this->configure();
        $this->queueMessage([], 'refusal');
        $user = $this->makeUser('requester');

        $this->actingAs($user)->postJson('/api/ai/draft', ['title' => 'Prosedur Uji', 'doc_type' => 'SOP', 'function_id' => 'hse'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'menolak'));

        $this->queueMessage(['purpose' => 'x'], 'max_tokens');
        $this->actingAs($user)->postJson('/api/ai/draft', ['title' => 'Prosedur Uji', 'doc_type' => 'SOP', 'function_id' => 'hse'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'terpotong'));

        $this->assertSame(0, AiGeneration::count());
    }

    public function test_invalid_api_key_gives_friendly_message(): void
    {
        $this->configure();
        $this->queue[] = new Response(401, ['Content-Type' => 'application/json'], '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}');

        $this->actingAs($this->makeUser('requester'))
            ->postJson('/api/ai/draft', ['title' => 'Prosedur Uji', 'doc_type' => 'SOP', 'function_id' => 'hse'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'API Key ditolak'));
    }

    public function test_role_without_permission_is_forbidden(): void
    {
        $user = $this->makeUser('reviewer');
        $this->actingAs($user)->getJson('/api/ai/status')->assertForbidden();
        $this->actingAs($user)->postJson('/api/ai/discover', ['topic' => 'Prosedur apa saja'])->assertForbidden();
        $this->actingAs($user)->postJson('/api/ai/draft', ['title' => 'Prosedur Uji', 'doc_type' => 'SOP', 'function_id' => 'hse'])->assertForbidden();
    }

    public function test_hourly_limit_stops_further_calls(): void
    {
        $this->configure();
        $user = $this->makeUser('requester');
        for ($i = 0; $i < 20; $i++) {
            RateLimiter::hit("ai-assistant:{$user->id}", 3600);
        }

        $this->actingAs($user)->postJson('/api/ai/draft', ['title' => 'Prosedur Uji', 'doc_type' => 'SOP', 'function_id' => 'hse'])
            ->assertStatus(429);
        $this->assertCount(0, $this->sent);
    }

    public function test_status_reports_configuration_without_exposing_key(): void
    {
        $user = $this->makeUser('requester');
        $this->actingAs($user)->getJson('/api/ai/status')->assertOk()->assertJsonPath('configured', false);

        $this->configure();
        $res = $this->actingAs($user)->getJson('/api/ai/status')->assertOk()
            ->assertJsonPath('configured', true)->assertJsonPath('model', 'claude-opus-5')->assertJsonPath('can_request', true);
        $this->assertStringNotContainsString(self::KEY, $res->getContent());
    }

    public function test_integration_settings_store_key_encrypted_and_test_connection(): void
    {
        $admin = $this->makeUser('sysadmin');

        $res = $this->actingAs($admin)->patchJson('/api/integrations/ai', [
            'enabled' => true, 'config' => ['model' => 'claude-sonnet-5'], 'secrets' => ['api_key' => self::KEY],
        ])->assertOk()->assertJsonPath('secrets_present.api_key', true)->assertJsonPath('config.model', 'claude-sonnet-5');
        $this->assertStringNotContainsString(self::KEY, $res->getContent());
        $this->assertStringNotContainsString(self::KEY, (string) \DB::table('integration_settings')->where('type', 'ai')->value('secrets'));

        $this->actingAs($admin)->patchJson('/api/integrations/ai', ['config' => ['model' => 'gpt-bukan-claude']])->assertUnprocessable();

        $this->queue[] = new Response(200, ['Content-Type' => 'application/json'], json_encode([
            'type' => 'model', 'id' => 'claude-sonnet-5', 'display_name' => 'Claude Sonnet 5', 'created_at' => '2026-01-01T00:00:00Z',
        ]));
        $this->actingAs($admin)->postJson('/api/integrations/ai/test')->assertOk()->assertJsonPath('status', 'connected');
        $this->assertStringEndsWith('/v1/models/claude-sonnet-5', $this->sent[0]->getUri()->getPath());

        $this->queue[] = new Response(401, ['Content-Type' => 'application/json'], '{"type":"error","error":{"type":"authentication_error","message":"invalid"}}');
        $this->actingAs($admin)->postJson('/api/integrations/ai/test')->assertStatus(422)->assertJsonPath('status', 'failed');
    }

    public function test_reporting_ai_adoption_uses_follow_up_ratio(): void
    {
        $user = $this->makeUser('requester');
        foreach ([true, false, false, true] as $used) {
            AiGeneration::create(['user_id' => $user->id, 'kind' => 'discover', 'subject' => 's', 'model' => 'claude-opus-5',
                'followed_up_at' => $used ? now() : null]);
        }
        $admin = $this->makeUser('compliance_admin');

        $kpis = collect($this->actingAs($admin)->getJson('/api/reporting/kpi')->assertOk()->json('kpis'));
        $ai = $kpis->firstWhere('key', 'ai_adoption');
        $this->assertEquals(50, $ai['value']);
        $this->assertSame('ok', $ai['status']);
    }
}
