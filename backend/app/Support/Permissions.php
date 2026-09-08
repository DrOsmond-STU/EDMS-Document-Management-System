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

    // Risiko & audit
    public const RISK_MANAGE = 'risk.manage';
    public const RISK_VIEW = 'risk.view';
    public const AUDIT_VIEW = 'audit.view';
    public const AUDIT_PLAN = 'audit.plan';
    public const AUDIT_CONDUCT = 'audit.conduct';
    public const FINDING_MANAGE = 'finding.manage';
    public const FINDING_CLOSE = 'finding.close';
    public const MGMT_REVIEW_CHAIR = 'mgmt_review.chair';
    public const MGMT_REVIEW_VIEW = 'mgmt_review.view';

    /** @var array<string, list<string>> */
    private const ROLE_PERMISSIONS = [
        'requester' => [
            self::DOCUMENT_REQUEST, self::DOCUMENT_VIEW_RELEASED,
            self::RISK_VIEW, self::MGMT_REVIEW_VIEW,
        ],
        'drafter' => [
            self::DOCUMENT_DRAFT, self::DOCUMENT_VIEW_RELEASED, self::RISK_VIEW,
        ],
        'reviewer' => [
            self::DOCUMENT_REVIEW, self::DOCUMENT_VIEW_RELEASED, self::RISK_VIEW,
        ],
        'approver' => [
            self::DOCUMENT_APPROVE, self::DOCUMENT_VIEW_RELEASED,
            self::RISK_VIEW, self::MGMT_REVIEW_VIEW,
        ],
        'controller' => [
            self::DOCUMENT_CONTROL, self::DOCUMENT_VIEW_RELEASED, self::REPORTING_VIEW,
            self::RISK_VIEW, self::FINDING_MANAGE, self::MGMT_REVIEW_VIEW,
        ],
        'ratifier' => [
            self::DOCUMENT_RATIFY, self::DOCUMENT_VIEW_RELEASED,
            self::MGMT_REVIEW_CHAIR, self::MGMT_REVIEW_VIEW,
        ],
        'function_head' => [
            self::DOCUMENT_VIEW_RELEASED, self::REPORTING_VIEW, self::RISK_MANAGE,
            self::RISK_VIEW, self::FINDING_MANAGE, self::MGMT_REVIEW_VIEW,
        ],
        'compliance_admin' => [
            self::COMPLIANCE_MANAGE, self::DOCUMENT_VIEW_RELEASED, self::REPORTING_VIEW,
            self::RISK_MANAGE, self::RISK_VIEW, self::AUDIT_PLAN, self::AUDIT_CONDUCT,
            self::FINDING_MANAGE, self::FINDING_CLOSE, self::MGMT_REVIEW_CHAIR,
            self::MGMT_REVIEW_VIEW,
        ],
        'sysadmin' => [
            self::MASTERDATA_MANAGE, self::USERS_MANAGE, self::DOCUMENT_VIEW_RELEASED,
            self::AUDIT_VIEW, self::RISK_VIEW, self::MGMT_REVIEW_VIEW,
        ],
        'auditor' => [
            self::AUDIT_VIEW, self::DOCUMENT_VIEW_RELEASED, self::REPORTING_VIEW,
            self::RISK_VIEW, self::AUDIT_PLAN, self::AUDIT_CONDUCT,
            self::FINDING_MANAGE, self::MGMT_REVIEW_VIEW,
        ],
        'viewer' => [
            self::DOCUMENT_VIEW_RELEASED, self::RISK_VIEW, self::MGMT_REVIEW_VIEW,
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
