<?php
// Padanan PHP dari src/state/permissions.ts — HARUS tetap sinkron dengan file
// itu. Ini otoritas RBAC sungguhan (dipanggil dispatch.php sebelum setiap
// aksi); pengecekan di frontend hanya kenyamanan UI (sembunyikan/nonaktifkan
// tombol), bukan batas keamanan.

function edms_role_permissions(): array {
    return [
        'requester' => ['document.request', 'document.view_released', 'risk.view', 'mgmt_review.view'],
        'drafter' => ['document.draft', 'document.view_released', 'risk.view'],
        'reviewer' => ['document.review', 'document.view_released', 'risk.view'],
        'approver' => ['document.approve', 'document.view_released', 'risk.view', 'mgmt_review.view'],
        'controller' => ['document.control', 'document.view_released', 'reporting.view', 'risk.view', 'finding.manage', 'mgmt_review.view'],
        'ratifier' => ['document.ratify', 'document.view_released', 'mgmt_review.chair', 'mgmt_review.view'],
        'function_head' => ['document.view_released', 'reporting.view', 'risk.manage', 'risk.view', 'finding.manage', 'mgmt_review.view'],
        'compliance_admin' => ['compliance.manage', 'document.view_released', 'reporting.view', 'risk.manage', 'risk.view', 'audit.plan', 'audit.conduct', 'finding.manage', 'finding.close', 'mgmt_review.chair', 'mgmt_review.view'],
        'sysadmin' => ['masterdata.manage', 'users.manage', 'document.view_released', 'audit.view', 'risk.view', 'mgmt_review.view'],
        'auditor' => ['audit.view', 'document.view_released', 'reporting.view', 'risk.view', 'audit.plan', 'audit.conduct', 'finding.manage', 'mgmt_review.view'],
        'viewer' => ['document.view_released', 'risk.view', 'mgmt_review.view'],
    ];
}

function edms_roles_have_permission(array $roles, string $permission): bool {
    $map = edms_role_permissions();
    foreach ($roles as $r) {
        if (in_array($permission, $map[$r] ?? [], true)) return true;
    }
    return false;
}

function edms_status_transition_role(): array {
    return [
        'draft' => ['drafter', 'controller'],
        'review' => ['reviewer', 'controller'],
        'approval' => ['approver', 'controller'],
        'released' => ['ratifier', 'controller'],
        'obsolete' => [],
    ];
}

function edms_can_transition(array $roles, string $from): bool {
    $allowed = edms_status_transition_role()[$from] ?? [];
    foreach ($roles as $r) {
        if (in_array($r, $allowed, true)) return true;
    }
    return false;
}

/** Padanan ACTION_PERMISSION di permissions.ts. */
function edms_action_permission(): array {
    return [
        'ADD_FUNCTION' => 'masterdata.manage',
        'ADD_STANDARD' => 'masterdata.manage',
        'ADD_USER' => 'users.manage',
        'TOGGLE_USER_ACTIVE' => 'users.manage',
        'RESET_DEMO_DATA' => 'masterdata.manage',

        'CREATE_INTERNAL_AUDIT' => 'audit.plan',
        'UPDATE_AUDIT_STATUS' => 'audit.plan',
        'CREATE_EXTERNAL_AUDIT' => 'audit.plan',

        'ADD_FINDING' => 'finding.manage',
        'ADD_CAPA' => 'finding.manage',
        'COMPLETE_CAPA' => 'finding.manage',
        'ADD_VERIFICATION' => 'finding.manage',
        'UPDATE_FINDING_STATUS' => 'finding.manage',
        'SET_ROOT_CAUSE' => 'finding.manage',
        'CLOSE_FINDING' => 'finding.close',

        'CREATE_MGMT_REVIEW' => 'mgmt_review.chair',
        'ADD_MGMT_DECISION' => 'mgmt_review.chair',
        'ADD_MGMT_ACTION' => 'mgmt_review.chair',
        'CLOSE_MGMT_ACTION' => 'mgmt_review.chair',
        'UPDATE_MGMT_REVIEW_STATUS' => 'mgmt_review.chair',

        'ADD_GAP_FOLLOWUP' => 'compliance.manage',
        'UPDATE_GAP_FOLLOWUP_STATUS' => 'compliance.manage',
    ];
}

const EDMS_RISK_ACTIONS = ['CREATE_RISK', 'UPDATE_RISK_STATUS', 'ADD_RISK_CONTROL', 'ADD_RISK_REVIEW'];

/**
 * Satu-satunya otoritas "bolehkah pengguna ini menjalankan aksi ini sekarang".
 * $user perlu key 'id' dan 'roles'. $action adalah array aksi mentah (sudah
 * divalidasi tipenya). $state dipakai untuk aksi yang butuh konteks (mis.
 * status dokumen saat ini untuk TRANSITION_STATUS).
 */
function edms_can_perform_action(array $user, array $action, array $state): bool {
    $type = $action['type'];

    if ($type === 'TRANSITION_STATUS') {
        foreach ($state['documents'] as $d) {
            if ($d['id'] === $action['documentId']) {
                return edms_can_transition($user['roles'], $d['status']);
            }
        }
        return false;
    }

    if ($type === 'SET_USER_PASSWORD') {
        if ($action['userId'] === $user['id']) return true;
        return edms_roles_have_permission($user['roles'], 'users.manage');
    }

    if (in_array($type, EDMS_RISK_ACTIONS, true)) {
        return edms_roles_have_permission($user['roles'], 'risk.manage')
            || edms_roles_have_permission($user['roles'], 'compliance.manage');
    }

    $required = edms_action_permission()[$type] ?? null;
    if ($required === null) return true; // tidak ada gerbang khusus — cukup sesi valid & aktif
    return edms_roles_have_permission($user['roles'], $required);
}
