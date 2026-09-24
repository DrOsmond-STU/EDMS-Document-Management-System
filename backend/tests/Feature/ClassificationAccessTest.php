<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\User;
use App\Services\LicenseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Akses berdasarkan klasifikasi dokumen (need-to-know):
 * Internal: semua | Terbatas: drafter/reviewer/function head ke atas, +anggota
 * fungsi | Rahasia: approver/compliance admin ke atas, +drafter/reviewer/
 * function head di fungsinya | Sangat Rahasia: controller/auditor/ratifier,
 * +approver/compliance admin di fungsinya | Top Secret: hanya ratifier.
 * Pemilik/pembuat selalu boleh; sysadmin hanya sampai Internal.
 */
class ClassificationAccessTest extends TestCase
{
    use RefreshDatabase;

    private const LEVELS = ['public', 'internal', 'restricted', 'confidential', 'secret', 'top_secret'];

    /** @var array<string, Document> */
    private array $docs = [];

    protected function setUp(): void
    {
        parent::setUp();
        $service = app(LicenseService::class);
        $expires = now()->addYear()->toDateString();
        $this->postJson('/api/license/apply', [
            'license_key' => 'EDMS-TEST-0001', 'expires_at' => $expires, 'status' => 'active', 'company_name' => 'PT Uji',
            'signature' => $service->computeSignature('EDMS-TEST-0001', $expires, 'active', 'PT Uji', ''),
        ])->assertOk();
        OrgFunction::create(['id' => 'hse', 'name' => 'HSE', 'active' => true]);
        OrgFunction::create(['id' => 'fin', 'name' => 'Finance', 'active' => true]);

        foreach (self::LEVELS as $i => $level) {
            $this->docs[$level] = Document::create([
                'code' => sprintf('SOP-FIN-%03d', $i + 1), 'title' => "Dokumen {$level}", 'type' => 'SOP', 'function_id' => 'fin',
                'classification' => $level, 'status' => 'released', 'validity' => 'berlaku', 'version' => '1.0', 'revision_number' => 0,
            ]);
        }
    }

    private function user(string $role, ?string $function = 'hse'): User
    {
        Role::firstOrCreate(['id' => $role], ['label' => $role]);
        $user = User::create(['name' => $role, 'email' => "{$role}-{$function}@example.com", 'password' => 'rahasia-panjang-sekali',
            'active' => true, 'must_change_password' => false, 'function_id' => $function]);
        $user->roles()->attach($role);

        return $user;
    }

    /** @return list<string> klasifikasi yang terlihat di Register Dokumen */
    private function visibleLevels(User $user): array
    {
        $codes = collect($this->actingAs($user)->getJson('/api/documents?per_page=100')->assertOk()->json('data'))->pluck('classification')->all();
        sort($codes);

        return $codes;
    }

    private function expect(array $levels): array
    {
        sort($levels);

        return $levels;
    }

    public function test_clearance_per_role_for_documents_of_another_function(): void
    {
        $matrix = [
            'viewer' => ['public', 'internal'],
            'requester' => ['public', 'internal'],
            'sysadmin' => ['public', 'internal'],
            'drafter' => ['public', 'internal', 'restricted'],
            'reviewer' => ['public', 'internal', 'restricted'],
            'function_head' => ['public', 'internal', 'restricted'],
            'approver' => ['public', 'internal', 'restricted', 'confidential'],
            'compliance_admin' => ['public', 'internal', 'restricted', 'confidential'],
            'controller' => ['public', 'internal', 'restricted', 'confidential', 'secret'],
            'auditor' => ['public', 'internal', 'restricted', 'confidential', 'secret'],
            'ratifier' => self::LEVELS,
        ];
        foreach ($matrix as $role => $levels) {
            $this->assertSame($this->expect($levels), $this->visibleLevels($this->user($role, 'hse')), "Peran {$role} (fungsi lain)");
        }
    }

    public function test_own_function_gets_one_extra_level_but_never_top_secret(): void
    {
        $this->assertSame($this->expect(['public', 'internal', 'restricted']), $this->visibleLevels($this->user('viewer', 'fin')));
        $this->assertSame($this->expect(['public', 'internal', 'restricted', 'confidential']), $this->visibleLevels($this->user('function_head', 'fin')));
        $this->assertSame($this->expect(['public', 'internal', 'restricted', 'confidential', 'secret']), $this->visibleLevels($this->user('approver', 'fin')));
        $this->assertSame($this->expect(['public', 'internal', 'restricted', 'confidential', 'secret']), $this->visibleLevels($this->user('controller', 'fin')));
    }

    public function test_detail_and_file_access_follow_the_same_rule(): void
    {
        $viewer = $this->user('viewer');
        $this->actingAs($viewer)->getJson("/api/documents/{$this->docs['internal']->id}")->assertOk();
        $this->actingAs($viewer)->getJson("/api/documents/{$this->docs['confidential']->id}")->assertForbidden();
        $this->actingAs($viewer)->getJson("/api/documents/{$this->docs['confidential']->id}/comments")->assertForbidden();

        $controller = $this->user('controller');
        $this->actingAs($controller)->getJson("/api/documents/{$this->docs['secret']->id}")->assertOk();
        $this->actingAs($controller)->getJson("/api/documents/{$this->docs['top_secret']->id}")->assertForbidden();
        $this->actingAs($controller)->patchJson("/api/documents/{$this->docs['top_secret']->id}", ['title' => 'x'])->assertForbidden();
        $this->actingAs($controller)->postJson("/api/documents/{$this->docs['top_secret']->id}/lifecycle-action", [
            'action' => 'freeze', 'reason' => 'Uji pembekuan dokumen top secret',
        ])->assertForbidden();

        $this->actingAs($this->user('ratifier'))->getJson("/api/documents/{$this->docs['top_secret']->id}")->assertOk();
    }

    public function test_owner_and_creator_always_see_their_own_document(): void
    {
        $owner = $this->user('viewer');
        $this->docs['top_secret']->update(['owner_id' => $owner->id]);
        $this->actingAs($owner)->getJson("/api/documents/{$this->docs['top_secret']->id}")->assertOk();
        $this->assertContains('top_secret', $this->visibleLevels($owner));
    }

    public function test_search_knowledge_and_approval_board_respect_classification(): void
    {
        $viewer = $this->user('viewer');
        $search = $this->actingAs($viewer)->getJson('/api/search?q=Dokumen')->assertOk()->getContent();
        $this->assertStringContainsString('Dokumen internal', $search);
        $this->assertStringNotContainsString('Dokumen confidential', $search);
        $this->assertStringNotContainsString('Dokumen top_secret', $search);

        $this->docs['top_secret']->update(['status' => 'approval']);
        $board = $this->actingAs($this->user('controller'))->getJson('/api/approval-board')->assertOk()->getContent();
        $this->assertStringNotContainsString('Dokumen top_secret', $board);
    }

    public function test_dashboard_counts_only_documents_the_user_may_see(): void
    {
        $this->docs['public']->update(['status' => 'draft']);
        $viewer = $this->user('viewer');
        $visible = count($this->visibleLevels($viewer));
        $dash = $this->actingAs($viewer)->getJson('/api/dashboard')->assertOk();
        $this->assertSame($visible, $dash->json('totals.documents'), 'Angka dashboard harus sama dengan isi Register Dokumen pengguna.');
        $byClass = collect($dash->json('classification_breakdown'))->pluck('count', 'key');
        $this->assertSame(0, $byClass['top_secret']);
        $this->assertSame(0, $byClass['confidential']);

        $this->assertSame(6, $this->actingAs($this->user('ratifier'))->getJson('/api/dashboard')->json('totals.documents'));
    }
}
