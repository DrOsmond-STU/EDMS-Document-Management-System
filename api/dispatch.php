<?php
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/db.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (!edms_is_authenticated()) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthenticated']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
$action = $body['action'] ?? null;
$validTypes = edms_action_types();

if (!is_array($action) || !isset($action['type']) || !in_array($action['type'], $validTypes, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Aksi tidak valid.']);
    exit;
}

try {
    $state = edms_apply_action($action);
    echo json_encode(['state' => $state], JSON_UNESCAPED_UNICODE);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Gagal menyimpan perubahan. Periksa kredensial database di api/_lib/config.php.']);
}
