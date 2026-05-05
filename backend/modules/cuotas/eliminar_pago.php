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

  $columnaExiste = function (PDO $pdo, string $tabla, string $columna): bool {
    $stCol = $pdo->prepare("
      SELECT 1
        FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = :tabla
         AND COLUMN_NAME = :columna
       LIMIT 1
    ");
    $stCol->execute([':tabla' => $tabla, ':columna' => $columna]);
    return (bool)$stCol->fetchColumn();
  };

  $raw = file_get_contents('php://input');
  $body = json_decode($raw ?: '{}', true);
  if (!is_array($body)) $body = [];

  $id_alumno   = (int)($body['id_alumno'] ?? 0);
  $id_mes      = (int)($body['id_mes'] ?? 0);
  $anio        = (int)($body['anio'] ?? 0);
  $id_mes_real = (int)($body['id_mes_real'] ?? 0);

  if ($id_alumno <= 0 || ($id_mes <= 0 && $id_mes_real <= 0) || $anio <= 0) {
    json_out([
      'exito' => false,
      'mensaje' => 'Parámetros inválidos. Requiere id_alumno, anio, e id_mes o id_mes_real.',
    ], 400);
  }

  $mesObjetivo = $id_mes_real > 0 ? $id_mes_real : $id_mes;

  $sqlFind = "
    SELECT id_pago
    FROM pagos
    WHERE id_alumno = :id_alumno
      AND id_mes = :id_mes
      AND anio_aplicado = :anio
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

  if (!$row) {
    $idsCandidatos = [];

    if ($id_mes >= 3 && $id_mes <= 7) {
      $idsCandidatos = [15, 13];
    } elseif ($id_mes >= 8 && $id_mes <= 12) {
      $idsCandidatos = [16, 13];
    } else {
      $idsCandidatos = [13, 15, 16];
    }

    $placeholders = implode(',', array_fill(0, count($idsCandidatos), '?'));

    $sqlFallback = "
      SELECT id_pago
      FROM pagos
      WHERE id_alumno = ?
        AND anio_aplicado = ?
        AND id_mes IN ($placeholders)
      ORDER BY 
        CASE id_mes
          WHEN 15 THEN 1
          WHEN 16 THEN 2
          WHEN 13 THEN 3
          ELSE 99
        END,
        id_pago DESC
      LIMIT 1
    ";

    $params = [$id_alumno, $anio, ...$idsCandidatos];

    $st2 = $pdo->prepare($sqlFallback);
    $st2->execute($params);

    $row = $st2->fetch(PDO::FETCH_ASSOC);
  }

  if (!$row) {
    json_out([
      'exito' => false,
      'mensaje' => 'No se encontró un pago para eliminar en el año aplicado ' . $anio . '.',
      'debug' => [
        'id_alumno' => $id_alumno,
        'id_mes' => $id_mes,
        'id_mes_real' => $id_mes_real,
        'mes_objetivo' => $mesObjetivo,
        'anio_aplicado' => $anio,
      ],
    ], 404);
  }

  $id_pago = (int)$row['id_pago'];

  $pdo->beginTransaction();

  $egresosEliminados = 0;

  // Si el pago tenía un egreso automático de cobrador asociado, eliminarlo también
  // para que no quede una comisión huérfana en contabilidad.
  if ($columnaExiste($pdo, 'egresos', 'id_pago_origen')) {
    $delEgreso = $pdo->prepare("DELETE FROM egresos WHERE id_pago_origen = :id_pago");
    $delEgreso->execute([':id_pago' => $id_pago]);
    $egresosEliminados = (int)$delEgreso->rowCount();
  }

  $del = $pdo->prepare("DELETE FROM pagos WHERE id_pago = :id_pago LIMIT 1");
  $del->execute([':id_pago' => $id_pago]);

  $pdo->commit();

  json_out([
    'exito' => true,
    'mensaje' => 'Pago eliminado correctamente.',
    'id_pago_eliminado' => $id_pago,
    'egresos_cobrador_eliminados' => $egresosEliminados,
    'anio_aplicado' => $anio,
  ], 200);

} catch (Throwable $e) {
  if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
    $pdo->rollBack();
  }

  json_out([
    'exito' => false,
    'mensaje' => 'Error eliminando pago: ' . $e->getMessage(),
  ], 500);
}