<?php
// backend/modules/categorias/obtener_historial.php
require_once realpath(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json; charset=utf-8');

try {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : (isset($_POST['id']) ? (int)$_POST['id'] : 0);
    if ($id <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID inválido']);
        exit;
    }

    $sql = "SELECT precio_anterior, precio_nuevo, fecha_cambio
            FROM precios_historicos
            WHERE id_categoria = :id
            ORDER BY fecha_cambio DESC, id_historico DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $id]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['exito' => true, 'historial' => $rows]);
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error al obtener historial: ' . $e->getMessage()]);
}
