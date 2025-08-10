<?php
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

// Permitir preflight de CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Validar método
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
    exit;
}

// Leer y validar entrada
$input = json_decode(file_get_contents("php://input"), true);
$id_socio = $input['id_socio'] ?? null;
$periodos = $input['periodos'] ?? [];

if (!$id_socio || !is_array($periodos) || empty($periodos)) {
    echo json_encode(['exito' => false, 'mensaje' => 'Datos incompletos para registrar el pago']);
    exit;
}

try {
    $pdo->beginTransaction();
    $fecha = date('Y-m-d');

    $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM pagos WHERE id_socio = ? AND id_periodo = ?");
    $insertStmt = $pdo->prepare("INSERT INTO pagos (id_socio, id_periodo, fecha_pago) VALUES (?, ?, ?)");

    $yaPagados = [];
    $nuevosPagos = 0;

    foreach ($periodos as $id_periodo) {
        $checkStmt->execute([$id_socio, $id_periodo]);
        if ($checkStmt->fetchColumn() > 0) {
            $yaPagados[] = $id_periodo;
            continue;
        }

        $insertStmt->execute([$id_socio, $id_periodo, $fecha]);
        $nuevosPagos++;
    }

    $pdo->commit();

    // Respuestas personalizadas
    if ($nuevosPagos > 0 && count($yaPagados) === 0) {
        echo json_encode([
            'exito' => true,
            'mensaje' => 'Pago registrado correctamente'
        ]);
    } elseif ($nuevosPagos > 0 && count($yaPagados) > 0) {
        echo json_encode([
            'exito' => true,
            'mensaje' => 'Algunos períodos ya estaban registrados, otros se guardaron correctamente',
            'ya_pagados' => $yaPagados
        ]);
    } elseif ($nuevosPagos === 0 && count($yaPagados) > 0) {
        $mensaje = count($yaPagados) === 1
            ? 'Este período ya fue registrado anteriormente'
            : 'Estos períodos ya fueron registrados anteriormente';

        echo json_encode([
            'exito' => false,
            'mensaje' => $mensaje,
            'ya_pagados' => $yaPagados
        ]);
    } else {
        echo json_encode([
            'exito' => false,
            'mensaje' => 'No se registraron pagos'
        ]);
    }

} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error al registrar pagos: ' . $e->getMessage()
    ]);
}
