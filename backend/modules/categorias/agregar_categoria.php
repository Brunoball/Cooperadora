<?php
// backend/modules/categorias/agregar_categoria.php
require_once realpath(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json; charset=utf-8');

try {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) $data = $_POST;

    $nombre = strtoupper(trim($data['descripcion'] ?? $data['nombre'] ?? ''));
    if ($nombre === '') {
        echo json_encode(['exito' => false, 'mensaje' => 'El nombre de la categoría es obligatorio']);
        exit;
    }

    $mMens  = $data['monto'] ?? $data['precio'] ?? 0;
    $mAnual = $data['monto_anual'] ?? 0;

    $mMens  = (int)($mMens  === '' ? 0 : $mMens);
    $mAnual = (int)($mAnual === '' ? 0 : $mAnual);

    if ($mMens < 0 || $mAnual < 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'Los montos deben ser >= 0']);
        exit;
    }

    $sql = "INSERT INTO categoria_monto (nombre_categoria, monto_mensual, monto_anual, fecha_creacion)
            VALUES (:nombre, :m_mensual, :m_anual, CURDATE())";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':nombre'    => $nombre,
        ':m_mensual' => $mMens,
        ':m_anual'   => $mAnual,
    ]);

    echo json_encode(['exito' => true, 'mensaje' => 'Categoría creada', 'id' => $pdo->lastInsertId()]);
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error al crear categoría: ' . $e->getMessage()]);
}
