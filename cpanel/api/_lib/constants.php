<?php
// Padanan PHP dari src/constants.ts dan src/types.ts (hanya bagian yang dipakai backend).

function edms_document_type_code(): array {
    return [
        'Kebijakan' => 'KBJ',
        'Manual' => 'MAN',
        'SOP' => 'SOP',
        'Work Instruction' => 'WI',
        'Formulir' => 'FRM',
    ];
}

function edms_drafting_stage_order(): array {
    return [
        'permintaan',
        'undangan_rapat',
        'rapat',
        'bukti_notulen',
        'daftar_hadir',
        'finalisasi',
        'pengesahan',
        'register_utama',
    ];
}

function edms_now_ms(): int {
    return (int) round(microtime(true) * 1000);
}

// Password bawaan prototipe — didokumentasikan di layar login & README.
// Pengguna mana pun (hasil seed baru atau data lama yang belum punya
// passwordHash) otomatis dimigrasi ke hash password ini saat pertama kali
// dibaca (lihat edms_migrate_passwords() di db.php), supaya tidak ada yang
// terkunci keluar. Sysadmin sebaiknya minta semua orang menggantinya lewat
// Manajemen Pengguna -> Reset Password atau menu "Ganti Password" sendiri.
const EDMS_DEFAULT_PASSWORD = 'Edms#2026';

function edms_action_types(): array {
    return [
        'CREATE_DOCUMENT',
        'TRANSITION_STATUS',
        'MARK_NOTIFICATION_READ',
        'MARK_ALL_NOTIFICATIONS_READ',
        'ADD_FUNCTION',
        'ADD_STANDARD',
        'ADD_USER',
        'TOGGLE_USER_ACTIVE',
        'SET_USER_PASSWORD',
        'CREATE_DRAFTING_REQUEST',
        'ADD_MEETING',
        'SET_FINALIZED_CONTENT',
        'ADVANCE_STAGE',
        // Risk & audit
        'CREATE_RISK',
        'UPDATE_RISK_STATUS',
        'ADD_RISK_CONTROL',
        'ADD_RISK_REVIEW',
        'CREATE_INTERNAL_AUDIT',
        'UPDATE_AUDIT_STATUS',
        'CREATE_EXTERNAL_AUDIT',
        'ADD_FINDING',
        'ADD_CAPA',
        'COMPLETE_CAPA',
        'ADD_VERIFICATION',
        'CLOSE_FINDING',
        'UPDATE_FINDING_STATUS',
        'SET_ROOT_CAUSE',
        'CREATE_MGMT_REVIEW',
        'ADD_MGMT_DECISION',
        'ADD_MGMT_ACTION',
        'CLOSE_MGMT_ACTION',
        'UPDATE_MGMT_REVIEW_STATUS',
        // Compliance matrix — tindak lanjut gap
        'ADD_GAP_FOLLOWUP',
        'UPDATE_GAP_FOLLOWUP_STATUS',
        'RESET_DEMO_DATA',
    ];
}

/** 5×5 heat map — level bucket per (likelihood, impact). Mirrors riskLevelFor() in src/types.ts. */
function edms_risk_level_for(int $l, int $i): string {
    $score = $l * $i;
    if ($score >= 20) return 'extreme';
    if ($score >= 12) return 'high';
    if ($score >= 6) return 'moderate';
    return 'low';
}

/** Generic prefix + year + running number code helper (RSK-YYYY-NNN, IA-YYYY-NNN, …). */
function edms_next_code_for(array $items, string $prefix): string {
    $year = gmdate('Y');
    $full = $prefix . '-' . $year . '-';
    $max = 0;
    foreach ($items as $it) {
        if (isset($it['code']) && strpos($it['code'], $full) === 0) {
            $n = (int) substr($it['code'], strrpos($it['code'], '-') + 1);
            if ($n > $max) $max = $n;
        }
    }
    return $full . str_pad((string)($max + 1), 3, '0', STR_PAD_LEFT);
}
