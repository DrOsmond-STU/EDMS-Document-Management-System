<?php
require_once __DIR__ . '/_lib/auth.php';
require_once __DIR__ . '/_lib/db.php';
require_once __DIR__ . '/_lib/permissions.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$userId = edms_current_user_id();
if (!$userId) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthenticated']);
    exit;
}

$body = json_decode(file_get_contents('php://input'), true);
$rawAction = $body['action'] ?? null;
$validTypes = edms_action_types();

if (!is_array($rawAction) || !isset($rawAction['type']) || !in_array($rawAction['type'], $validTypes, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Aksi tidak valid.']);
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

    if ($rawAction['type'] === 'SET_USER_PASSWORD') {
        $targetUserId = is_string($rawAction['userId'] ?? null) ? $rawAction['userId'] : '';
        $newPassword = is_string($rawAction['newPassword'] ?? null) ? $rawAction['newPassword'] : '';
        $currentPassword = is_string($rawAction['currentPassword'] ?? null) ? $rawAction['currentPassword'] : '';
        $targetUser = null;
        foreach ($state['users'] as $u) {
            if ($u['id'] === $targetUserId) { $targetUser = $u; break; }
        }
        if (!$targetUser || strlen($newPassword) < 8) {
            http_response_code(400);
            echo json_encode(['error' => 'Password baru minimal 8 karakter.']);
            exit;
        }
        $isSelf = $targetUserId === $currentUser['id'];
        $isManager = edms_roles_have_permission($currentUser['roles'], 'users.manage');
        if (!$isSelf && !$isManager) {
            http_response_code(403);
            echo json_encode(['error' => 'Anda tidak berwenang mengubah password pengguna lain.']);
            exit;
        }
        if ($isSelf && !$isManager && !password_verify($currentPassword, $targetUser['passwordHash'] ?? '')) {
            http_response_code(400);
            echo json_encode(['error' => 'Password Anda saat ini salah.']);
            exit;
        }
        $action = [
            'type' => 'SET_USER_PASSWORD',
            'userId' => $targetUserId,
            'passwordHash' => password_hash($newPassword, PASSWORD_BCRYPT),
            'actor' => $currentUser['name'],
        ];
    } else {
        $action = $rawAction;
        $action['actor'] = $currentUser['name']; // klien tidak bisa mengklaim jadi orang lain
    }

    if (!edms_can_perform_action($currentUser, $action, $state)) {
        http_response_code(403);
        echo json_encode(['error' => 'Anda tidak berwenang melakukan aksi ini.']);
        exit;
    }

    $next = edms_apply_action($action);
    echo json_encode(['state' => edms_sanitize_for_client($next)], JSON_UNESCAPED_UNICODE);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Gagal menyimpan perubahan. Periksa kredensial database di api/_lib/config.php.']);
}
