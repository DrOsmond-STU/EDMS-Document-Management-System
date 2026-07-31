<?php
// Gerbang password sederhana berbasis cookie yang ditandatangani (HMAC),
// padanan dari api/_lib/auth.ts versi Vercel. Aktif hanya jika app_password diisi.
require_once __DIR__ . '/constants.php';

const EDMS_COOKIE_NAME = 'edms_session';
const EDMS_MAX_AGE = 2592000; // 30 hari

function edms_app_password(): ?string {
    static $config = null;
    if ($config === null) $config = require __DIR__ . '/config.php';
    $p = $config['app_password'] ?? '';
    return ($p !== '') ? $p : null;
}

function edms_is_protected(): bool {
    return edms_app_password() !== null;
}

function edms_sign(string $payload, string $secret): string {
    return hash_hmac('sha256', $payload, $secret);
}

function edms_check_password(string $password): bool {
    $secret = edms_app_password();
    if ($secret === null) return true;
    return hash_equals($secret, $password);
}

function edms_is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function edms_issue_session_cookie(): void {
    $secret = edms_app_password();
    if ($secret === null) return;
    $expiry = (string) (edms_now_ms() + EDMS_MAX_AGE * 1000);
    $token = $expiry . '.' . edms_sign($expiry, $secret);
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

function edms_is_authenticated(): bool {
    $secret = edms_app_password();
    if ($secret === null) return true;
    $token = $_COOKIE[EDMS_COOKIE_NAME] ?? null;
    if (!$token || strpos($token, '.') === false) return false;
    [$expiryStr, $sig] = explode('.', $token, 2);
    $expiry = (float) $expiryStr;
    if ($expiry <= 0 || $expiry < edms_now_ms()) return false;
    return hash_equals(edms_sign($expiryStr, $secret), $sig);
}
