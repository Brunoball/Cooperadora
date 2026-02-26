<?php
declare(strict_types=1);

// backend/modules/categorias/obtener_historial_hermanos.php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'Conexión PDO no disponible.'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $id_cat_monto = isset($_GET['id_cat_monto']) ? (int)$_GET['id_cat_monto'] : 0;
  if ($id_cat_monto <= 0) {
    http_response_code(400);
    echo json_encode(['exito' => false, 'mensaje' => 'Falta id_cat_monto'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $st = $pdo->prepare("
    SELECT
      h.id_hist,
      h.id_cat_hermanos,
      ch.cantidad_hermanos,
      h.tipo,
      h.precio_anterior,
      h.precio_nuevo,
      h.fecha_cambio
    FROM cooperadora.categoria_hermanos_historial h
    INNER JOIN cooperadora.categoria_hermanos ch
      ON ch.id_cat_hermanos = h.id_cat_hermanos
    WHERE ch.id_cat_monto = :id
    ORDER BY h.fecha_cambio DESC, h.id_hist DESC
  ");
  $st->execute([':id' => $id_cat_monto]);
  $rows = $st->fetchAll(PDO::FETCH_ASSOC);

  echo json_encode(['exito' => true, 'historial' => $rows], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode([
    'exito' => false,
    'mensaje' => 'Error al obtener historial',
    'detalle' => $e->getMessage()
  ], JSON_UNESCAPED_UNICODE);
}