<?php
// Per-user session cookie, signed with HMAC — padanan dari api/_lib/auth.ts
// versi Vercel. Menggantikan gerbang password bersama lama: setiap request
// sekarang membawa id pengguna yang benar-benar terautentikasi, dipakai oleh
// dispatch.php untuk RBAC (lihat permissions.php) dan untuk mencatat audit
// log — klien tidak bisa lagi mengklaim jadi siapa pun lewat field actor.
require_once __DIR__ . '/constants.php';

const EDMS_COOKIE_NAME = 'edms_session';
const EDMS_MAX_AGE = 2592000; // 30 hari

// Sebaiknya operator mengisi 'session_secret' eksplisit di config.php untuk
// deployment produksi sungguhan. Jika kosong, turunkan secret dari kredensial
// database supaya prototipe tetap langsung jalan tanpa konfigurasi tambahan
// (konsekuensinya: secret ikut berubah jika kredensial DB diganti).
function edms_session_secret(): string {
    static $secret = null;
    if ($secret !== null) return $secret;
    $config = require __DIR__ . '/config.php';
    $explicit = $config['session_secret'] ?? '';
    if ($explicit !== '') {
        $secret = $explicit;
        return $secret;
    }
    $secret = hash('sha256', 'edms-session|' . ($config['db_host'] ?? '') . '|' . ($config['db_name'] ?? '') . '|' . ($config['db_user'] ?? ''));
    return $secret;
}

function edms_sign(string $payload): string {
    return hash_hmac('sha256', $payload, edms_session_secret());
}

function edms_is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function edms_issue_session_cookie(string $userId): void {
    $expiry = edms_now_ms() + EDMS_MAX_AGE * 1000;
    $payload = $userId . '.' . $expiry;
    $token = $payload . '.' . edms_sign($payload);
    setcookie(EDMS_COOKIE_NAME, $token, [
        'expires' => time() + EDMS_MAX_AGE,
        'path' => '/',
        'secure' => edms_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function edms_clear_session_cookie(): void {
    setcookie(EDMS_COOKIE_NAME, '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => edms_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/** Mengembalikan id pengguna dari session cookie, atau null bila tidak valid. */
function edms_current_user_id(): ?string {
    $token = $_COOKIE[EDMS_COOKIE_NAME] ?? null;
    if (!$token) return null;
    $lastDot = strrpos($token, '.');
    if ($lastDot === false) return null;
    $payload = substr($token, 0, $lastDot);
    $sig = substr($token, $lastDot + 1);
    $secondDot = strrpos($payload, '.');
    if ($secondDot === false) return null;
    $userId = substr($payload, 0, $secondDot);
    $expiryStr = substr($payload, $secondDot + 1);
    $expiry = (float) $expiryStr;
    if ($userId === '' || $expiry <= 0 || $expiry < edms_now_ms()) return null;
    if (!hash_equals(edms_sign($payload), $sig)) return null;
    return $userId;
}
