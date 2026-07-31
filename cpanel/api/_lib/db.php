<?php
require_once __DIR__ . '/reducer.php';

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
        return json_decode($row['state'], true);
    }
    $seed = edms_initial_state();
    $ins = $pdo->prepare('INSERT INTO app_state (id, state) VALUES (1, :state)');
    $ins->execute([':state' => json_encode($seed, JSON_UNESCAPED_UNICODE)]);
    return $seed;
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
