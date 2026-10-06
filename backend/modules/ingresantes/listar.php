<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

require_once __DIR__ . '/../../config/db.php';

try {
    if (!isset($pdo) || !($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    $ciclo = isset($_GET['ciclo']) ? (int)$_GET['ciclo'] : 2027;
    if ($ciclo < 2020 || $ciclo > 2100) {
        $ciclo = 2027;
    }

    $stmt = $pdo->prepare(
        "SELECT id_ingresante, apellido, nombre, dni, anio_ingreso, ciclo_lectivo,
                matricula_pagada, monto_matricula, fecha_inscripcion, observaciones
           FROM ingresantes
          WHERE ciclo_lectivo = :ciclo
          ORDER BY fecha_inscripcion DESC, id_ingresante DESC"
    );
    $stmt->execute([':ciclo' => $ciclo]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    foreach ($rows as &$row) {
        $row['id_ingresante'] = (int)$row['id_ingresante'];
        $row['anio_ingreso'] = (int)$row['anio_ingreso'];
        $row['ciclo_lectivo'] = (int)$row['ciclo_lectivo'];
        $row['matricula_pagada'] = (int)$row['matricula_pagada'];
        $row['monto_matricula'] = $row['monto_matricula'] !== null ? (int)$row['monto_matricula'] : null;
    }
    unset($row);

    $montoMatricula = 0;
    $montoStmt = $pdo->query("SELECT monto FROM meses WHERE id_mes = 14 LIMIT 1");
    if ($montoStmt) {
        $montoMatricula = (int)($montoStmt->fetchColumn() ?: 0);
    }

    echo json_encode([
        'exito' => true,
        'ingresantes' => $rows,
        'monto_matricula_actual' => $montoMatricula,
        'ciclo_lectivo' => $ciclo,
    ], JSON_UNESCAPED_UNICODE);
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error al obtener ingresantes: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
