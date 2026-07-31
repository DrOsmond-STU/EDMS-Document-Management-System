<?php
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/db.php';

header('Content-Type: application/json; charset=utf-8');

if (!edms_is_authenticated()) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthenticated']);
    exit;
}

try {
    $state = edms_read_state();
    echo json_encode(['state' => $state], JSON_UNESCAPED_UNICODE);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Gagal memuat data. Periksa kredensial database di api/_lib/config.php.']);
}
