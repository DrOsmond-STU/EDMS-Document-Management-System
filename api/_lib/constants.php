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
        'CREATE_DRAFTING_REQUEST',
        'ADD_MEETING',
        'SET_FINALIZED_CONTENT',
        'ADVANCE_STAGE',
        'RESET_DEMO_DATA',
    ];
}
