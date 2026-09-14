<?php
declare(strict_types=1);
// Diagnóstico LOCAL para el arranque del testing. No modifica tablas ni datos.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$remote = (string)($_SERVER['REMOTE_ADDR'] ?? '');
if (!in_array($remote, ['127.0.0.1', '::1'], true)) {
    http_response_code(404);
    echo json_encode(['exito' => false]);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    echo json_encode(['exito' => false]);
    exit;
}
require __DIR__ . '/../config/db.php';
try {
    $pdo->query('SELECT 1 FROM usuarios LIMIT 1');
    $pdo->query('SELECT 1 FROM alumnos LIMIT 1');
    echo json_encode(['application' => 'cooperadora', 'database_connected' => true]);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode(['application' => 'cooperadora', 'database_connected' => false,
        'mensaje' => 'La base seleccionada no tiene las tablas usuarios y alumnos accesibles.'], JSON_UNESCAPED_UNICODE);
}
