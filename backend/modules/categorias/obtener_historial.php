<?php
// backend/modules/categorias/obtener_historial.php
require_once realpath(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json; charset=utf-8');

try {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0; // id_cat_monto
    if ($id <= 0) { echo json_encode([]); exit; }

    $sql = "SELECT
                id_historico,
                precio_anterior,
                precio_nuevo,
                DATE_FORMAT(fecha_cambio, '%Y-%m-%d') AS fecha_cambio,
                tipo
            FROM precios_historicos
            WHERE id_cat_monto = :id
            ORDER BY fecha_cambio DESC, id_historico DESC";
    $st = $pdo->prepare($sql);
    $st->execute([':id' => $id]);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['exito' => true, 'historial' => $rows], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error al obtener historial: ' . $e->getMessage()]);
}
