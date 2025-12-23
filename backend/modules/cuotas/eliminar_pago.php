<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

function json_out(array $arr): void {
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

try {
  $raw = file_get_contents('php://input');
  $body = json_decode($raw ?: '{}', true);
  if (!is_array($body)) $body = [];

  $id_alumno   = (int)($body['id_alumno'] ?? 0);
  $id_mes      = (int)($body['id_mes'] ?? 0);        // mes seleccionado (ej: enero)
  $anio        = (int)($body['anio'] ?? 0);          // año de pago seleccionado
  $id_mes_real = (int)($body['id_mes_real'] ?? 0);   // mes real a borrar (contado anual / h1 / h2)

  if ($id_alumno <= 0 || ($id_mes <= 0 && $id_mes_real <= 0) || $anio <= 0) {
    json_out([
      'exito' => false,
      'mensaje' => 'Parámetros inválidos. Requiere: id_alumno, anio, e id_mes o id_mes_real.',
    ]);
  }

  // Si vino id_mes_real (por el modal), borramos directo ese.
  $mesObjetivo = $id_mes_real > 0 ? $id_mes_real : $id_mes;

  // 1) Intento borrar el pago exacto de ese mesObjetivo en ese año
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
    ':id_mes' => $mesObjetivo,
    ':anio' => $anio,
  ]);
  $row = $st->fetch(PDO::FETCH_ASSOC);

  // 2) Si no existe y NO vino id_mes_real, hacemos fallback a contado anual/h1/h2
  if (!$row && $id_mes_real <= 0) {
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
    $st2 = $pdo->prepare($sqlFallback);
    $st2->execute([
      ':id_alumno' => $id_alumno,
      ':anio' => $anio,
    ]);
    $row2 = $st2->fetch(PDO::FETCH_ASSOC);

    if ($row2) {
      $row = ['id_pago' => $row2['id_pago']];
      // Nota: si querés, podés devolver un mensaje específico de que se eliminó contado
    }
  }

  if (!$row) {
    json_out([
      'exito' => false,
      'mensaje' => 'No se encontró un pago para eliminar (ni mensual ni contado) para ese alumno y año.',
    ]);
  }

  $id_pago = (int)$row['id_pago'];

  $pdo->beginTransaction();
  $del = $pdo->prepare("DELETE FROM pagos WHERE id_pago = :id_pago LIMIT 1");
  $del->execute([':id_pago' => $id_pago]);
  $pdo->commit();

  json_out([
    'exito' => true,
    'mensaje' => 'Pago eliminado correctamente.',
    'id_pago_eliminado' => $id_pago,
  ]);

} catch (Throwable $e) {
  if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
  json_out([
    'exito' => false,
    'mensaje' => 'Error eliminando pago: ' . $e->getMessage(),
  ]);
}
