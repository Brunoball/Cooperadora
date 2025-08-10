<?php
// modules/pagos/periodos_pagados.php
require_once __DIR__ . '/../../config/db.php';
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");

$idAlumno = isset($_GET['id_alumno']) ? (int)$_GET['id_alumno'] : 0;

try {
    if ($pdo instanceof PDO) {
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    } else {
        throw new RuntimeException('Conexión PDO no disponible');
    }

    if ($idAlumno <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID de alumno inválido']);
        exit;
    }

    // Pagos ya hechos (ids de mes)
    $stmt = $pdo->prepare("SELECT id_mes FROM pagos WHERE id_alumno = :id");
    $stmt->execute([':id' => $idAlumno]);
    $pagados = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));

    // Fecha de ingreso
    $stmt2 = $pdo->prepare("SELECT ingreso FROM alumnos WHERE id_alumno = :id");
    $stmt2->execute([':id' => $idAlumno]);
    $row = $stmt2->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        echo json_encode(['exito' => false, 'mensaje' => 'Alumno no encontrado']);
        exit;
    }

    echo json_encode([
        'exito' => true,
        'periodos_pagados' => $pagados,
        'ingreso' => $row['ingreso']
    ]);
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error en la base de datos']);
}
