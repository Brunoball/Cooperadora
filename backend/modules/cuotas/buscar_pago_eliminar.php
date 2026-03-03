<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

try {
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    json_out(['exito' => false, 'mensaje' => 'Conexión PDO no disponible.'], 500);
  }

  $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
  }
  if ($method !== 'POST') {
    json_out(['exito' => false, 'mensaje' => 'Método no permitido (usar POST).'], 405);
  }

  $raw = file_get_contents('php://input');
  $body = json_decode($raw ?: '{}', true);
  if (!is_array($body)) $body = [];

  $id_alumno = (int)($body['id_alumno'] ?? 0);
  $id_mes    = (int)($body['id_mes'] ?? 0);
  $anio      = (int)($body['anio'] ?? 0);

  if ($id_alumno <= 0 || $id_mes <= 0 || $anio <= 0) {
    json_out([
      'exito' => false,
      'mensaje' => 'Parámetros inválidos. Requiere: id_alumno, id_mes, anio.',
    ], 400);
  }

  // 1) Buscar pago exacto mensual del mes seleccionado
  $sqlMensual = "
    SELECT p.id_pago, p.id_mes, m.nombre AS mes_nombre
    FROM pagos p
    INNER JOIN meses m ON m.id_mes = p.id_mes
    WHERE p.id_alumno = :id_alumno
      AND p.id_mes = :id_mes
      AND YEAR(p.fecha_pago) = :anio
    ORDER BY p.id_pago DESC
    LIMIT 1
  ";
  $st = $pdo->prepare($sqlMensual);
  $st->execute([
    ':id_alumno' => $id_alumno,
    ':id_mes'    => $id_mes,
    ':anio'      => $anio,
  ]);
  $row = $st->fetch(PDO::FETCH_ASSOC);

  if ($row) {
    json_out([
      'exito' => true,
      'tipo' => 'MENSUAL',
      'id_pago' => (int)$row['id_pago'],
      'id_mes_real' => (int)$row['id_mes'],
      'mes_nombre' => (string)($row['mes_nombre'] ?? ''),
      'warning' => false,
      'warning_text' => '',
    ]);
  }

  // 2) Fallback: anual / contado / h1 / h2 / semestre (si no existe el mensual)
  $sqlFallback = "
    SELECT p.id_pago, p.id_mes, m.nombre AS mes_nombre
    FROM pagos p
    INNER JOIN meses m ON m.id_mes = p.id_mes
    WHERE p.id_alumno = :id_alumno
      AND YEAR(p.fecha_pago) = :anio
      AND (
        LOWER(m.nombre) LIKE '%anual%'
        OR LOWER(m.nombre) LIKE '%contado%'
        OR LOWER(m.nombre) LIKE '%h1%'
        OR LOWER(m.nombre) LIKE '%h2%'
        OR LOWER(m.nombre) LIKE '%semestre%'
        OR LOWER(m.nombre) LIKE '%mitad%'
      )
    ORDER BY
      CASE
        WHEN LOWER(m.nombre) LIKE '%anual%' THEN 1
        WHEN LOWER(m.nombre) LIKE '%contado%' THEN 2
        WHEN LOWER(m.nombre) LIKE '%h1%' THEN 3
        WHEN LOWER(m.nombre) LIKE '%h2%' THEN 4
        WHEN LOWER(m.nombre) LIKE '%semestre%' THEN 5
        WHEN LOWER(m.nombre) LIKE '%mitad%' THEN 6
        ELSE 99
      END,
      p.id_pago DESC
    LIMIT 1
  ";
  $st2 = $pdo->prepare($sqlFallback);
  $st2->execute([
    ':id_alumno' => $id_alumno,
    ':anio'      => $anio,
  ]);
  $row2 = $st2->fetch(PDO::FETCH_ASSOC);

  if ($row2) {
    $nombre = mb_strtolower((string)($row2['mes_nombre'] ?? ''), 'UTF-8');
    $texto = "⚠️ Este alumno no tiene pago mensual en ese período, pero sí un pago ";
    if (str_contains($nombre, 'anual') || str_contains($nombre, 'contado')) {
      $texto .= "ANUAL/CONTADO";
    } elseif (str_contains($nombre, 'h1') || str_contains($nombre, '1')) {
      $texto .= "de 1ER MITAD (H1)";
    } elseif (str_contains($nombre, 'h2') || str_contains($nombre, '2')) {
      $texto .= "de 2DA MITAD (H2)";
    } else {
      $texto .= "SEMIANUAL/MITAD";
    }
    $texto .= ". Si eliminás, se elimina el período completo.";

    json_out([
      'exito' => true,
      'tipo' => 'PERIODO_COMPLETO',
      'id_pago' => (int)$row2['id_pago'],
      'id_mes_real' => (int)$row2['id_mes'],
      'mes_nombre' => (string)($row2['mes_nombre'] ?? ''),
      'warning' => true,
      'warning_text' => $texto,
    ]);
  }

  // nada encontrado
  json_out([
    'exito' => false,
    'mensaje' => 'No se encontró pago mensual ni anual/mitad para ese alumno y año.',
  ], 404);

} catch (Throwable $e) {
  json_out([
    'exito' => false,
    'mensaje' => 'Error buscando pago a eliminar: ' . $e->getMessage(),
  ], 500);
}