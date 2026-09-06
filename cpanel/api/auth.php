<?php
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/db.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
$email = is_string($body['email'] ?? null) ? strtolower(trim($body['email'])) : '';
$password = is_string($body['password'] ?? null) ? $body['password'] : '';

if ($email === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Email dan password wajib diisi.']);
    exit;
}

try {
    $state = edms_read_state();
    $found = null;
    foreach ($state['users'] as $u) {
        if (strtolower($u['email']) === $email) { $found = $u; break; }
    }

    if (!$found || !$found['active'] || !password_verify($password, $found['passwordHash'] ?? '')) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Email atau password salah.']);
        exit;
    }

    edms_issue_session_cookie($found['id']);
    echo json_encode(['ok' => true]);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Gagal menghubungi server. Periksa kredensial database di api/_lib/config.php.']);
}
