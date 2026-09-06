<?php
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/db.php';

header('Content-Type: application/json; charset=utf-8');

$userId = edms_current_user_id();
if (!$userId) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthenticated']);
    exit;
}

try {
    $state = edms_read_state();
    $currentUser = null;
    foreach ($state['users'] as $u) {
        if ($u['id'] === $userId) { $currentUser = $u; break; }
    }
    if (!$currentUser || !$currentUser['active']) {
        edms_clear_session_cookie();
        http_response_code(401);
        echo json_encode(['error' => 'unauthenticated']);
        exit;
    }
    echo json_encode(['state' => edms_sanitize_for_client($state), 'currentUserId' => $userId], JSON_UNESCAPED_UNICODE);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Gagal memuat data. Periksa kredensial database di api/_lib/config.php.']);
}
