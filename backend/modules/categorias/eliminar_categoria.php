<?php
// backend/modules/categorias/eliminar_categoria.php
require_once realpath(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json; charset=utf-8');

try {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) $data = $_POST;

    $id = isset($data['id']) ? (int)$data['id'] : 0;

    if ($id <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID inválido']);
        exit;
    }

    $sql = "DELETE FROM categoria WHERE id_categoria = :id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $id]);

    echo json_encode(['exito' => true, 'mensaje' => 'Categoría eliminada']);
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error al eliminar categoría: ' . $e->getMessage()]);
}
