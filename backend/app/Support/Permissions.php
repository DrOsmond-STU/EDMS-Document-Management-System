<?php

namespace App\Support;

/**
 * Matriks RBAC. Sengaja ditaruh di kode, bukan di tabel database, karena:
 * - perubahan hak akses jadi terekam di riwayat git dan bisa ditinjau,
 * - tidak ada jalur untuk menaikkan hak akses lewat manipulasi data,
 * - isinya kecil dan jarang berubah.
 *
 * Peran mana yang dipegang seorang pengguna tetap data (tabel role_user);
 * yang dikunci di kode adalah arti dari tiap peran.
 */
final class Permissions
{
    // Dokumen
    public const DOCUMENT_REQUEST = 'document.request';
    public const DOCUMENT_DRAFT = 'document.draft';
    public const DOCUMENT_REVIEW = 'document.review';
    public const DOCUMENT_APPROVE = 'document.approve';
    public const DOCUMENT_CONTROL = 'document.control';
    public const DOCUMENT_RATIFY = 'document.ratify';
    public const DOCUMENT_VIEW_RELEASED = 'document.view_released';

    // Administrasi
    public const MASTERDATA_MANAGE = 'masterdata.manage';
    public const USERS_MANAGE = 'users.manage';
    public const REPORTING_VIEW = 'reporting.view';
    public const COMPLIANCE_MANAGE = 'compliance.manage';
    public const SYSTEM_ADMIN = 'system.admin'; // panel System Administration
    public const AI_USE = 'ai.use'; // Asisten AI (memakai kuota API berbayar)

    // Risiko & audit
    public const RISK_MANAGE = 'risk.manage';
    public const RISK_VIEW = 'risk.view';
    public const AUDIT_VIEW = 'audit.view'; // Audit Trail (jejak log sistem)
    public const AUDIT_PROGRAM_VIEW = 'audit_program.view'; // Program Audit Internal/Eksternal
    public const AUDIT_PLAN = 'audit.plan';
    public const AUDIT_CONDUCT = 'audit.conduct';
    public const FINDING_MANAGE = 'finding.manage';
    public const FINDING_CLOSE = 'finding.close';
    public const MGMT_REVIEW_CHAIR = 'mgmt_review.chair';
    public const MGMT_REVIEW_VIEW = 'mgmt_review.view';

    // Legal Register — kewajiban kepatuhan (ISO 14001/45001 6.1.3)
    public const LEGAL_VIEW = 'legal.view';
    public const LEGAL_MANAGE = 'legal.manage';

    // Records Management — register rekaman & jadwal retensi (JRA)
    public const RECORDS_VIEW = 'records.view';
    public const RECORDS_MANAGE = 'records.manage';
    public const RECORDS_DISPOSE = 'records.dispose'; // pemusnahan/penyerahan permanen — tak bisa dibatalkan

    /** @var array<string, list<string>> */
    private const ROLE_PERMISSIONS = [
        'requester' => [
            self::DOCUMENT_REQUEST, self::DOCUMENT_VIEW_RELEASED,
            self::RISK_VIEW, self::MGMT_REVIEW_VIEW,
            self::LEGAL_VIEW,
            self::RECORDS_VIEW,
            self::AI_USE,
        ],
        'drafter' => [
            self::DOCUMENT_DRAFT, self::DOCUMENT_VIEW_RELEASED, self::RISK_VIEW,
            self::LEGAL_VIEW,
            self::RECORDS_VIEW,
            self::AI_USE,
        ],
        'reviewer' => [
            self::DOCUMENT_REVIEW, self::DOCUMENT_VIEW_RELEASED, self::RISK_VIEW,
            self::LEGAL_VIEW,
            self::RECORDS_VIEW,
        ],
        'approver' => [
            self::DOCUMENT_APPROVE, self::DOCUMENT_VIEW_RELEASED,
            self::RISK_VIEW, self::MGMT_REVIEW_VIEW,
            self::AUDIT_PROGRAM_VIEW,
            self::LEGAL_VIEW,
            self::RECORDS_VIEW,
        ],
        'controller' => [
            self::DOCUMENT_CONTROL, self::DOCUMENT_VIEW_RELEASED, self::REPORTING_VIEW,
            self::RISK_VIEW, self::FINDING_MANAGE, self::MGMT_REVIEW_VIEW,
            self::AUDIT_PROGRAM_VIEW,
            self::LEGAL_VIEW,
            self::RECORDS_VIEW, self::RECORDS_MANAGE,
            self::AI_USE,
        ],
        'ratifier' => [
            self::DOCUMENT_RATIFY, self::DOCUMENT_VIEW_RELEASED,
            self::MGMT_REVIEW_CHAIR, self::MGMT_REVIEW_VIEW,
            self::AUDIT_PROGRAM_VIEW,
            self::LEGAL_VIEW,
            self::RECORDS_VIEW, self::RECORDS_DISPOSE,
        ],
        'function_head' => [
            self::DOCUMENT_VIEW_RELEASED, self::REPORTING_VIEW, self::RISK_MANAGE,
            self::RISK_VIEW, self::FINDING_MANAGE, self::MGMT_REVIEW_VIEW,
            self::AUDIT_PROGRAM_VIEW,
            self::LEGAL_VIEW,
            self::RECORDS_VIEW,
            self::AI_USE,
        ],
        'compliance_admin' => [
            self::COMPLIANCE_MANAGE, self::DOCUMENT_VIEW_RELEASED, self::REPORTING_VIEW,
            self::RISK_MANAGE, self::RISK_VIEW, self::AUDIT_PLAN, self::AUDIT_CONDUCT,
            self::FINDING_MANAGE, self::FINDING_CLOSE, self::MGMT_REVIEW_CHAIR,
            self::MGMT_REVIEW_VIEW,
            self::AUDIT_PROGRAM_VIEW,
            self::LEGAL_VIEW, self::LEGAL_MANAGE,
            self::RECORDS_VIEW, self::RECORDS_MANAGE, self::RECORDS_DISPOSE,
            self::AI_USE,
        ],
        'sysadmin' => [
            self::MASTERDATA_MANAGE, self::USERS_MANAGE, self::DOCUMENT_VIEW_RELEASED,
            self::AUDIT_VIEW, self::RISK_VIEW, self::MGMT_REVIEW_VIEW,
            self::LEGAL_VIEW,
            self::RECORDS_VIEW,
            self::SYSTEM_ADMIN,
        ],
        'auditor' => [
            self::AUDIT_VIEW, self::DOCUMENT_VIEW_RELEASED, self::REPORTING_VIEW,
            self::RISK_VIEW, self::AUDIT_PLAN, self::AUDIT_CONDUCT,
            self::FINDING_MANAGE, self::MGMT_REVIEW_VIEW,
            self::AUDIT_PROGRAM_VIEW,
            self::LEGAL_VIEW,
            self::RECORDS_VIEW,
        ],
        'viewer' => [
            self::DOCUMENT_VIEW_RELEASED, self::RISK_VIEW, self::MGMT_REVIEW_VIEW,
            self::LEGAL_VIEW,
            self::RECORDS_VIEW,
        ],
    ];

    /**
     * Peran mana yang berhak memindahkan dokumen KELUAR dari suatu status.
     * Inilah yang menegakkan alur Draft → Review → Approval → Released →
     * Obsolete: tiap tahap hanya bisa didorong oleh peran yang berwenang.
     *
     * @var array<string, list<string>>
     */
    private const STATUS_TRANSITION_ROLES = [
        'draft' => ['drafter', 'controller'],
        'review' => ['reviewer', 'controller'],
        'approval' => ['approver', 'controller'],
        'released' => ['ratifier', 'controller'],
        'obsolete' => [],
    ];

    /** @param list<string> $roleIds */
    /**
     * Tingkat klasifikasi dokumen, dari paling terbuka ke paling tertutup.
     * Dipakai bersama oleh DocumentPolicy (satu dokumen) dan
     * Document::scopeVisibleTo (daftar/pencarian) — satu sumber aturan.
     */
    public const CLASSIFICATION_LEVELS = [
        'public' => 0, 'internal' => 1, 'restricted' => 2, 'confidential' => 3, 'secret' => 4, 'top_secret' => 5,
    ];

    /**
     * Izin klasifikasi tertinggi per peran (need-to-know, ISO 27001 5.12).
     * Pengguna mendapat SATU tingkat tambahan untuk dokumen milik fungsinya
     * sendiri (maksimal Secret) — lihat clearanceFor(). Top Secret hanya
     * untuk Ratifier (manajemen puncak); pemilik/pembuat dokumen selalu bisa
     * melihat dokumennya sendiri. System Administrator sengaja hanya
     * Internal: pengelola IT tidak perlu membaca isi dokumen bisnis.
     */
    public const ROLE_CLEARANCE = [
        'viewer' => 'internal', 'requester' => 'internal', 'sysadmin' => 'internal',
        'drafter' => 'restricted', 'reviewer' => 'restricted', 'function_head' => 'restricted',
        'approver' => 'confidential', 'compliance_admin' => 'confidential',
        'controller' => 'secret', 'auditor' => 'secret',
        'ratifier' => 'top_secret',
    ];

    /** Batas atas bonus "fungsi sendiri" — Top Secret tidak pernah didapat lewat bonus. */
    private const OWN_FUNCTION_CAP = 'secret';

    /** Tingkat izin (0..5) seorang pengguna; $ownFunction = dokumen milik fungsinya sendiri. */
    public static function clearanceFor(array $roleIds, bool $ownFunction = false): int
    {
        $level = self::CLASSIFICATION_LEVELS['public'];
        foreach ($roleIds as $roleId) {
            if (isset(self::ROLE_CLEARANCE[$roleId])) {
                $level = max($level, self::CLASSIFICATION_LEVELS[self::ROLE_CLEARANCE[$roleId]]);
            }
        }
        if ($ownFunction && $level < self::CLASSIFICATION_LEVELS[self::OWN_FUNCTION_CAP]) {
            $level = min($level + 1, self::CLASSIFICATION_LEVELS[self::OWN_FUNCTION_CAP]);
        }

        return $level;
    }

    /** @return list<string> kode klasifikasi dengan tingkat <= $level */
    public static function classificationsUpTo(int $level): array
    {
        return array_keys(array_filter(self::CLASSIFICATION_LEVELS, fn (int $l) => $l <= $level));
    }

    public static function rolesHave(array $roleIds, string $permission): bool
    {
        foreach ($roleIds as $roleId) {
            if (in_array($permission, self::ROLE_PERMISSIONS[$roleId] ?? [], true)) {
                return true;
            }
        }

        return false;
    }

    /** @param list<string> $roleIds */
    public static function canTransitionFrom(array $roleIds, string $status): bool
    {
        $allowed = self::STATUS_TRANSITION_ROLES[$status] ?? [];

        return count(array_intersect($roleIds, $allowed)) > 0;
    }

    /**
     * Bekukan/cairkan/cabut/batalkan/tandai-digantikan — sengaja SAMA
     * untuk semua aksi (bukan per tahap seperti canTransitionFrom) karena
     * ini tindakan pengecualian/darurat di luar alur normal siapa-
     * menyetujui-tahap-apa, bukan bagian rantai persetujuan itu sendiri.
     *
     * @param list<string> $roleIds
     */
    public static function canPerformLifecycleActions(array $roleIds): bool
    {
        return in_array('controller', $roleIds, true) || in_array('sysadmin', $roleIds, true);
    }

    /** @return list<string> */
    public static function forRoles(array $roleIds): array
    {
        $permissions = [];
        foreach ($roleIds as $roleId) {
            foreach (self::ROLE_PERMISSIONS[$roleId] ?? [] as $permission) {
                $permissions[$permission] = true;
            }
        }

        return array_keys($permissions);
    }

    /** @return list<string> */
    public static function allRoleIds(): array
    {
        return array_keys(self::ROLE_PERMISSIONS);
    }
}
