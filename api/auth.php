<?php
require_once __DIR__ . '/_lib/auth.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

if (!edms_is_protected()) {
    edms_issue_session_cookie();
    echo json_encode(['ok' => true]);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
$password = is_string($body['password'] ?? null) ? $body['password'] : '';

if (!edms_check_password($password)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Password salah.']);
    exit;
}

edms_issue_session_cookie();
echo json_encode(['ok' => true]);
