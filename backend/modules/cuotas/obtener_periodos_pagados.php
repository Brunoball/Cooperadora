<?php
require_once __DIR__ . '/../../config/db.php';

// CORS
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

$idSocio = $_GET['id_socio'] ?? null;

if (!$idSocio) {
    echo json_encode(['exito' => false, 'mensaje' => 'ID de socio no proporcionado']);
    exit;
}

try {
    // Obtener períodos pagados
    $stmtPagos = $pdo->prepare("SELECT id_periodo FROM pagos WHERE id_socio = ?");
    $stmtPagos->execute([$idSocio]);
    $periodos = $stmtPagos->fetchAll(PDO::FETCH_COLUMN);

    // Obtener fecha de ingreso
    $stmtIngreso = $pdo->prepare("SELECT ingreso FROM socios WHERE id_socio = ?");
    $stmtIngreso->execute([$idSocio]);
    $socio = $stmtIngreso->fetch(PDO::FETCH_ASSOC);

    if (!$socio) {
        echo json_encode(['exito' => false, 'mensaje' => 'Socio no encontrado']);
        exit;
    }

    echo json_encode([
        'exito' => true,
        'periodos_pagados' => array_map('intval', $periodos),
        'ingreso' => $socio['ingreso']
    ]);
} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error en la base de datos']);
}
