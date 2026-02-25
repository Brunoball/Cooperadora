<?php
// backend/modules/alumnos/toggle_cobrador.php

header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  echo json_encode(['exito' => true]);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(200);
  echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
  exit;
}

require_once __DIR__ . '/../../config/db.php';

try {
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    throw new Exception('Conexión PDO no disponible.');
  }
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->exec("SET NAMES utf8mb4");

  $raw = file_get_contents('php://input');
  $body = json_decode($raw ? $raw : '[]', true);
  if (!is_array($body)) $body = [];

  $id = isset($body['id_alumno']) ? (int)$body['id_alumno'] : 0;
  if ($id <= 0) {
    throw new Exception('id_alumno inválido.');
  }

  // Si te mandan "valor" lo setea directo (0/1). Si no, toggle.
  $tieneValor = array_key_exists('valor', $body);
  $valor = $tieneValor ? (int)$body['valor'] : null;

  if ($tieneValor) {
    $valor = ($valor === 1) ? 1 : 0;

    $upd = $pdo->prepare("UPDATE alumnos SET es_cobrador = :v WHERE id_alumno = :id");
    $upd->execute([':v' => $valor, ':id' => $id]);

    $nuevo = $valor;
  } else {
    $upd = $pdo->prepare("
      UPDATE alumnos
      SET es_cobrador = CASE WHEN IFNULL(es_cobrador,0) = 1 THEN 0 ELSE 1 END
      WHERE id_alumno = :id
    ");
    $upd->execute([':id' => $id]);

    $q = $pdo->prepare("SELECT es_cobrador FROM alumnos WHERE id_alumno = :id LIMIT 1");
    $q->execute([':id' => $id]);
    $row = $q->fetch(PDO::FETCH_ASSOC);
    $nuevo = (int)($row['es_cobrador'] ?? 0);
  }

  echo json_encode([
    'exito' => true,
    'id_alumno' => $id,
    'es_cobrador' => (int)$nuevo,
  ], JSON_UNESCAPED_UNICODE);
  exit;

} catch (Throwable $e) {
  http_response_code(200);
  echo json_encode([
    'exito' => false,
    'mensaje' => 'Error: ' . $e->getMessage()
  ], JSON_UNESCAPED_UNICODE);
  exit;
}