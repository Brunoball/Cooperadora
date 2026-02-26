<?php
declare(strict_types=1);

// backend/modules/categorias/eliminar_cat_hermano.php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'Conexión PDO no disponible.'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $id_cat_hermanos = isset($_POST['id_cat_hermanos']) ? (int)$_POST['id_cat_hermanos'] : 0;
  if ($id_cat_hermanos <= 0) {
    http_response_code(400);
    echo json_encode(['exito' => false, 'mensaje' => 'Falta id_cat_hermanos'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $st = $pdo->prepare("DELETE FROM cooperadora.categoria_hermanos WHERE id_cat_hermanos = :id");
  $st->execute([':id' => $id_cat_hermanos]);

  echo json_encode(['exito' => true, 'mensaje' => 'Eliminado'], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['exito' => false, 'mensaje' => 'Error al eliminar', 'detalle' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}