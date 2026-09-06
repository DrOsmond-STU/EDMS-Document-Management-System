<?php
require_once __DIR__ . '/reducer.php';

/** Memastikan setiap pengguna punya passwordHash, mengisi EDMS_DEFAULT_PASSWORD
 * bagi yang belum (mencakup data lama dari sebelum fitur ini ada, bukan hanya
 * seed baru). Mengembalikan [state, changed]. */
function edms_migrate_passwords(array $state): array {
    $changed = false;
    foreach ($state['users'] as &$u) {
        if (!empty($u['passwordHash'])) continue;
        $u['passwordHash'] = password_hash(EDMS_DEFAULT_PASSWORD, PASSWORD_BCRYPT);
        $changed = true;
    }
    unset($u);
    return [$state, $changed];
}

/** Menghapus passwordHash sebelum sebuah state dikirim ke browser. */
function edms_sanitize_for_client(array $state): array {
    foreach ($state['users'] as &$u) {
        unset($u['passwordHash']);
    }
    unset($u);
    return $state;
}

function edms_get_pdo(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    $config = require __DIR__ . '/config.php';
    $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4";
    $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    return $pdo;
}

function edms_ensure_schema(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS app_state (
            id TINYINT PRIMARY KEY,
            state LONGTEXT NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
}

function edms_read_state(): array {
    $pdo = edms_get_pdo();
    edms_ensure_schema($pdo);
    $row = $pdo->query('SELECT state FROM app_state WHERE id = 1')->fetch();
    if ($row) {
        $state = json_decode($row['state'], true);
    } else {
        $state = edms_initial_state();
        $ins = $pdo->prepare('INSERT INTO app_state (id, state) VALUES (1, :state)');
        $ins->execute([':state' => json_encode($state, JSON_UNESCAPED_UNICODE)]);
    }
    [$state, $changed] = edms_migrate_passwords($state);
    if ($changed) {
        $upd = $pdo->prepare('UPDATE app_state SET state = :state WHERE id = 1');
        $upd->execute([':state' => json_encode($state, JSON_UNESCAPED_UNICODE)]);
    }
    return $state;
}

function edms_apply_action(array $action): array {
    $pdo = edms_get_pdo();
    edms_ensure_schema($pdo);
    $pdo->beginTransaction();
    try {
        $row = $pdo->query('SELECT state FROM app_state WHERE id = 1 FOR UPDATE')->fetch();
        if (!$row) {
            $seed = edms_initial_state();
            $ins = $pdo->prepare('INSERT INTO app_state (id, state) VALUES (1, :state)');
            $ins->execute([':state' => json_encode($seed, JSON_UNESCAPED_UNICODE)]);
            $current = $seed;
        } else {
            $current = json_decode($row['state'], true);
        }
        [$current] = edms_migrate_passwords($current);
        $next = edms_reducer($current, $action);
        $upd = $pdo->prepare('UPDATE app_state SET state = :state WHERE id = 1');
        $upd->execute([':state' => json_encode($next, JSON_UNESCAPED_UNICODE)]);
        $pdo->commit();
        return $next;
    } catch (\Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}
