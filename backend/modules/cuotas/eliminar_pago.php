<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

try {
  // ✅ Asegurar PDO
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    json_out(['exito' => false, 'mensaje' => 'Conexión PDO no disponible.'], 500);
  }

  // ✅ CORS preflight
  $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
  }

  if ($method !== 'POST') {
    json_out(['exito' => false, 'mensaje' => 'Método no permitido (usar POST).'], 405);
  }

  // ✅ Leer JSON
  $raw  = file_get_contents('php://input');
  $body = json_decode($raw ?: '{}', true);
  if (!is_array($body)) $body = [];

  $id_alumno   = (int)($body['id_alumno'] ?? 0);
  $id_mes      = (int)($body['id_mes'] ?? 0);        // mes seleccionado (ej: marzo)
  $anio        = (int)($body['anio'] ?? 0);          // año
  $id_mes_real = (int)($body['id_mes_real'] ?? 0);   // anual/h1/h2 real (si aplica)

  if ($id_alumno <= 0 || ($id_mes <= 0 && $id_mes_real <= 0) || $anio <= 0) {
    json_out([
      'exito' => false,
      'mensaje' => 'Parámetros inválidos. Requiere: id_alumno, anio, e id_mes o id_mes_real.',
    ], 400);
  }

  // ✅ Si vino id_mes_real (detectado por el modal), borramos ese. Si no, borramos id_mes.
  $mesObjetivo = $id_mes_real > 0 ? $id_mes_real : $id_mes;

  // 1) Buscar pago exacto del mes objetivo en el año
  $sqlFind = "
    SELECT id_pago
    FROM pagos
    WHERE id_alumno = :id_alumno
      AND id_mes = :id_mes
      AND YEAR(fecha_pago) = :anio
    ORDER BY id_pago DESC
    LIMIT 1
  ";
  $st = $pdo->prepare($sqlFind);
  $st->execute([
    ':id_alumno' => $id_alumno,
    ':id_mes'    => $mesObjetivo,
    ':anio'      => $anio,
  ]);
  $row = $st->fetch(PDO::FETCH_ASSOC);

  // 2) Si no hay mensual y NO vino id_mes_real, fallback a anual/h1/h2/semestre/contado
  if (!$row && $id_mes_real <= 0) {
    $sqlFallback = "
      SELECT p.id_pago
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
      $row = ['id_pago' => $row2['id_pago']];
    }
  }

  if (!$row) {
    json_out([
      'exito' => false,
      'mensaje' => 'No se encontró un pago para eliminar (ni mensual ni anual/mitad) para ese alumno y año.',
    ], 404);
  }

  $id_pago = (int)$row['id_pago'];

  // ✅ Eliminar
  $pdo->beginTransaction();
  $del = $pdo->prepare("DELETE FROM pagos WHERE id_pago = :id_pago LIMIT 1");
  $del->execute([':id_pago' => $id_pago]);
  $pdo->commit();

  json_out([
    'exito' => true,
    'mensaje' => 'Pago eliminado correctamente.',
    'id_pago_eliminado' => $id_pago,
    'id_mes_objetivo' => $mesObjetivo,
    'anio' => $anio,
  ], 200);

} catch (Throwable $e) {
  if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
  json_out([
    'exito' => false,
    'mensaje' => 'Error eliminando pago: ' . $e->getMessage(),
  ], 500);
}