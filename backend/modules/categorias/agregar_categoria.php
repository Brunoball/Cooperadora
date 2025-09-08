<?php
// backend/modules/categorias/agregar_categoria.php
require_once realpath(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json; charset=utf-8');

try {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) $data = $_POST;

    $descripcion = trim(strtoupper($data['descripcion'] ?? $data['nombre'] ?? ''));
    $monto = $data['monto'] ?? $data['precio'] ?? 0;

    if ($descripcion === '') {
        echo json_encode(['exito' => false, 'mensaje' => 'La descripción es obligatoria']);
        exit;
    }
    if ($monto === '' || $monto === null) $monto = 0;
    if (!is_numeric($monto) || $monto < 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'El monto debe ser un número mayor o igual a 0']);
        exit;
    }

    $sql = "INSERT INTO categoria (nombre_categoria, monto) VALUES (:nombre, :monto)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':nombre' => $descripcion,
        ':monto'  => (int)$monto
    ]);

    echo json_encode(['exito' => true, 'mensaje' => 'Categoría creada', 'id' => $pdo->lastInsertId()]);
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error al crear categoría: ' . $e->getMessage()]);
}
