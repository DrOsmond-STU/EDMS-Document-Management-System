<?php
require_once __DIR__ . '/_lib/auth.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

edms_clear_session_cookie();
echo json_encode(['ok' => true]);
