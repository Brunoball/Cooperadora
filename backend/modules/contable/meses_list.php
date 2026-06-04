<?php
/**
 * Endpoint liviano de compatibilidad:
 * /api.php?action=meses_list
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

try {
    if (!isset($pdo)) {
        require_once __DIR__ . '/../../config/db.php';
    }
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('SET NAMES utf8mb4');

    $st = $pdo->query('SELECT id_mes, nombre FROM meses ORDER BY id_mes ASC');
    $meses = $st->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'exito' => true,
        'meses' => $meses,
        'items' => $meses,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error al listar meses: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
