<?php
declare(strict_types=1);

/**
 * Helpers y DB compartidos por todos los endpoints de familias (ALUMNOS).
 */

require_once __DIR__ . '/../../../config/db.php';

if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['exito' => false, 'mensaje' => 'DB no inicializada ($pdo)']);
    exit;
}

function fam_pdo(): PDO {
    /** @var PDO $pdo */
    global $pdo;
    return $pdo;
}

function fam_json(array $arr, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($arr, JSON_UNESCAPED_UNICODE);
    exit;
}

function fam_str(mixed $v): string {
    return trim((string)$v);
}

function fam_int_or_null(mixed $v): ?int {
    return ($v === null || $v === '' || !isset($v)) ? null : (int)$v;
}

function fam_read_json(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
