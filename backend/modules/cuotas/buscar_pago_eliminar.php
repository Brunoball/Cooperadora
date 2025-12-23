<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php'; // ajustá si tu conexión está en otro path

header('Content-Type: application/json; charset=utf-8');

function json_out(array $arr): void {
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

/**
 * Busca el pago "real" que corresponde eliminar para un alumno+mes+anio.
 * - Primero intenta mensual (id_mes seleccionado)
 * - Si no existe, busca pagos "contado" (anual / h1 / h2) del mismo año
 */
try {
  $raw = file_get_contents('php://input');
  $body = json_decode($raw ?: '{}', true);
  if (!is_array($body)) $body = [];

  $id_alumno = (int)($body['id_alumno'] ?? 0);
  $id_mes    = (int)($body['id_mes'] ?? 0);
  $anio      = (int)($body['anio'] ?? 0);

  if ($id_alumno <= 0 || $id_mes <= 0 || $anio <= 0) {
    json_out([
      'exito' => false,
      'mensaje' => 'Parámetros inválidos (id_alumno, id_mes, anio).',
    ]);
  }

  // 1) Intentar pago mensual exacto para ese mes y año
  $sql1 = "
    SELECT p.id_pago, p.id_mes, m.nombre AS mes_nombre, p.estado, p.fecha_pago
    FROM pagos p
    INNER JOIN meses m ON m.id_mes = p.id_mes
    WHERE p.id_alumno = :id_alumno
      AND p.id_mes = :id_mes
      AND YEAR(p.fecha_pago) = :anio
    ORDER BY p.id_pago DESC
    LIMIT 1
  ";
  $st1 = $pdo->prepare($sql1);
  $st1->execute([
    ':id_alumno' => $id_alumno,
    ':id_mes' => $id_mes,
    ':anio' => $anio,
  ]);
  $row1 = $st1->fetch(PDO::FETCH_ASSOC);

  if ($row1) {
    json_out([
      'exito' => true,
      'tipo' => 'mensual',
      'id_pago' => (int)$row1['id_pago'],
      'id_mes_real' => (int)$row1['id_mes'],
      'mes_nombre_real' => (string)$row1['mes_nombre'],
      'estado' => (string)$row1['estado'],
      'fecha_pago' => (string)$row1['fecha_pago'],
      'warning' => false,
      'mensaje' => 'Se encontró un pago mensual para el mes seleccionado.',
    ]);
  }

  // 2) Fallback: si estás en un mes normal (enero..diciembre), buscar contado anual/h1/h2 en el año
  // Detectamos "contado" por nombre del mes en la tabla meses (ANUAL / H1 / H2).
  $sql2 = "
    SELECT p.id_pago, p.id_mes, m.nombre AS mes_nombre, p.estado, p.fecha_pago
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
      )
    ORDER BY
      CASE
        WHEN LOWER(m.nombre) LIKE '%anual%' THEN 1
        WHEN LOWER(m.nombre) LIKE '%h1%' THEN 2
        WHEN LOWER(m.nombre) LIKE '%h2%' THEN 3
        ELSE 9
      END,
      p.id_pago DESC
    LIMIT 1
  ";
  $st2 = $pdo->prepare($sql2);
  $st2->execute([
    ':id_alumno' => $id_alumno,
    ':anio' => $anio,
  ]);
  $row2 = $st2->fetch(PDO::FETCH_ASSOC);

  if ($row2) {
    $nombre = (string)$row2['mes_nombre'];
    $nombreN = mb_strtolower($nombre);

    $tipo = 'contado';
    if (str_contains($nombreN, 'anual')) $tipo = 'contado_anual';
    else if (str_contains($nombreN, 'h1')) $tipo = 'contado_h1';
    else if (str_contains($nombreN, 'h2')) $tipo = 'contado_h2';

    json_out([
      'exito' => true,
      'tipo' => $tipo,
      'id_pago' => (int)$row2['id_pago'],
      'id_mes_real' => (int)$row2['id_mes'],
      'mes_nombre_real' => $nombre,
      'estado' => (string)$row2['estado'],
      'fecha_pago' => (string)$row2['fecha_pago'],
      'warning' => true,
      'mensaje' => 'El mes seleccionado no tiene pago mensual, pero existe un pago de contado (anual/periodo).',
      'warning_text' => "⚠️ Este es un pago de {$nombre}. Si lo eliminás, eliminás el registro de contado.",
    ]);
  }

  // 3) Nada encontrado
  json_out([
    'exito' => false,
    'mensaje' => 'No se encontró un pago mensual para ese mes ni un pago de contado anual/periodo para ese alumno y año.',
  ]);

} catch (Throwable $e) {
  json_out([
    'exito' => false,
    'mensaje' => 'Error buscando pago a eliminar: ' . $e->getMessage(),
  ]);
}
