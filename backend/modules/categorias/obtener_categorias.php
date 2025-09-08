<?php
// backend/modules/categorias/obtener_categorias.php
require_once realpath(__DIR__ . '/../../config/db.php');

header('Content-Type: application/json; charset=utf-8');

try {
    $sql = "SELECT id_categoria AS id, nombre_categoria AS descripcion, monto
            FROM categoria
            ORDER BY id_categoria ASC";
    $st = $pdo->query($sql);
    $rows = $st ? $st->fetchAll(PDO::FETCH_ASSOC) : [];
    echo json_encode($rows ?: []);
} catch (Throwable $e) {
    echo json_encode(['error' => true, 'mensaje' => 'Error al obtener categorías: ' . $e->getMessage()]);
}
