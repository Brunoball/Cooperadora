<?php
// backend/modules/categorias/obtener_categorias.php
require_once realpath(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json; charset=utf-8');

try {
    $sql = "SELECT
                id_cat_monto                       AS id,
                nombre_categoria                   AS descripcion,
                monto_mensual                      AS monto,
                monto_anual,
                DATE_FORMAT(fecha_creacion, '%Y-%m-%d') AS fecha_creacion
            FROM categoria_monto
            ORDER BY id_cat_monto ASC";
    $st = $pdo->query($sql);
    $rows = $st ? $st->fetchAll(PDO::FETCH_ASSOC) : [];
    echo json_encode($rows ?: []);
} catch (Throwable $e) {
    echo json_encode(['error' => true, 'mensaje' => 'Error al obtener categorías: ' . $e->getMessage()]);
}
