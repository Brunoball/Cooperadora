<?php
// modules/pagos/registrar_pago.php
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

try {
  if (!($pdo instanceof PDO)) {
    throw new RuntimeException('Conexión PDO no disponible');
  }
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  /* ==========================================================
     1) Leer payload
     ========================================================== */
  $payload = json_decode(file_get_contents('php://input'), true) ?: [];

  $idAlumno  = isset($payload['id_alumno']) ? (int)$payload['id_alumno'] : 0;
  $periodos  = isset($payload['periodos']) && is_array($payload['periodos']) ? $payload['periodos'] : [];
  $condonar  = !empty($payload['condonar']);

  // ✅ ahora "anio" es AÑO APLICADO
  $anioAplicado = isset($payload['anio']) ? (int)$payload['anio'] : (int)date('Y');

  // Medio de pago
  $idMedioPago = isset($payload['id_medio_pago']) && $payload['id_medio_pago'] !== ''
    ? (int)$payload['id_medio_pago'] : null;

  // Monto libre / unitario
  $montoLibre = isset($payload['monto_libre']) ? (int)$payload['monto_libre'] : 0;
  $montoUI    = isset($payload['monto_unitario']) ? (int)$payload['monto_unitario'] : null;

  // Montos por periodo
  $montosPorPeriodo = [];
  if (!empty($payload['montos_por_periodo']) && is_array($payload['montos_por_periodo'])) {
    foreach ($payload['montos_por_periodo'] as $k => $v) {
      $kk = (int)$k;
      $vv = (int)$v;
      $montosPorPeriodo[$kk] = $vv;
    }
  }

  /* ==========================================================
     2) Grupo familiar (ids_familia)
     ========================================================== */
  $aplicarFamilia = !empty($payload['aplicar_a_familia']);
  $idsFamilia     = [];

  if ($aplicarFamilia && isset($payload['ids_familia']) && is_array($payload['ids_familia'])) {
    foreach ($payload['ids_familia'] as $idf) {
      $idClean = (int)$idf;
      if ($idClean > 0 && $idClean !== $idAlumno) {
        $idsFamilia[$idClean] = true;
      }
    }
  }
  $idsFamilia = array_keys($idsFamilia);

  /* ==========================================================
     3) Validaciones mínimas
     ========================================================== */
  if ($idAlumno <= 0) {
    echo json_encode(['exito' => false, 'mensaje' => 'ID de alumno inválido'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  if (empty($periodos)) {
    echo json_encode(['exito' => false, 'mensaje' => 'No se enviaron períodos a registrar'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  if ($anioAplicado < 2000 || $anioAplicado > 2100) {
    $anioAplicado = (int)date('Y');
  }

  $estadoRegistrar = $condonar ? 'condonado' : 'pagado';

  // ✅ fecha_pago = fecha real de cobro (HOY)
  $hoy = new DateTime();
  $fechaPago = $hoy->format('Y-m-d');

  /* ==========================================================
     4) Helpers
     ========================================================== */

  $resolverMonto = function (
    bool $condonar,
    ?int $montoUI,
    int $montoLibre,
    array $montosPorPeriodo,
    int $periodo
  ): int {
    if ($condonar) return 0;

    if (isset($montosPorPeriodo[$periodo]) && is_int($montosPorPeriodo[$periodo]) && $montosPorPeriodo[$periodo] >= 0) {
      return (int)$montosPorPeriodo[$periodo];
    }
    if (!is_null($montoUI) && $montoUI > 0) return (int)$montoUI;
    if ($montoLibre > 0) return (int)$montoLibre;
    return 0;
  };

  $parsearSeleccion = function (array $periodos, array $montosPorPeriodo, bool $condonar): array {
    $mesesExplicitos = []; // 1..12
    $matricula       = false;
    $segmentos       = []; // 13,15,16 con total

    foreach ($periodos as $p) {
      $p = (int)$p;
      if ($p >= 1 && $p <= 12) {
        $mesesExplicitos[$p] = true;
      } elseif ($p === 14) {
        $matricula = true;
      } elseif ($p === 13 || $p === 15 || $p === 16) {
        $total = isset($montosPorPeriodo[$p]) ? (int)$montosPorPeriodo[$p] : 0;
        $segmentos[] = [
          'id_mes' => $p,
          'total'  => $condonar ? 0 : $total,
        ];
      }
    }

    ksort($mesesExplicitos);

    return [
      'mesesExplicitos' => array_keys($mesesExplicitos),
      'matricula'       => $matricula,
      'segmentos'       => $segmentos,
    ];
  };

  $construirMontosMensuales = function (
    array $mesesExplicitos,
    array $montosPorPeriodo,
    bool $condonar,
    ?int $montoUI,
    int $montoLibre
  ) use ($resolverMonto): array {
    $map = [];
    foreach ($mesesExplicitos as $m) {
      $m = (int)$m;
      if ($m < 1 || $m > 12) continue;
      $map[$m] = $resolverMonto($condonar, $montoUI, $montoLibre, $montosPorPeriodo, $m);
    }
    ksort($map);
    return $map;
  };

  /* ==========================================================
     5) Interpretar selección
     ========================================================== */
  $seleccion        = $parsearSeleccion($periodos, $montosPorPeriodo, $condonar);
  $mesesExplicitos  = $seleccion['mesesExplicitos'];
  $matriculaSel     = $seleccion['matricula'];
  $segmentos        = $seleccion['segmentos'];

  $montosPorMes = $construirMontosMensuales(
    $mesesExplicitos,
    $montosPorPeriodo,
    $condonar,
    $montoUI,
    $montoLibre
  );

  /* ==========================================================
     6) Consultas
     ========================================================== */

  // ✅ existentes por alumno + anio_aplicado (no por YEAR(fecha_pago))
  $stExist = $pdo->prepare("
    SELECT id_mes, estado
      FROM pagos
     WHERE id_alumno = :id_alumno
       AND anio_aplicado = :anio
  ");

  // ✅ insert incluye anio_aplicado
  $stIns = $pdo->prepare("
    INSERT INTO pagos (id_alumno, id_mes, anio_aplicado, fecha_pago, estado, monto_pago, id_medio_pago)
    VALUES (:id_alumno, :id_mes, :anio_aplicado, :fecha_pago, :estado, :monto_pago, :id_medio_pago)
  ");

  /* ==========================================================
     7) Alumnos objetivo
     ========================================================== */
  $alumnosObjetivo = [$idAlumno];

  if ($aplicarFamilia && !empty($idsFamilia)) {
    $set = [];
    foreach ($alumnosObjetivo as $idp) $set[(int)$idp] = true;
    foreach ($idsFamilia as $idf) $set[(int)$idf] = true;
    $alumnosObjetivo = array_map('intval', array_keys($set));
    sort($alumnosObjetivo);
  }

  /* ==========================================================
     8) Registrar
     ========================================================== */
  $totalInsertados  = 0;
  $detallePorAlumno = [];

  $pdo->beginTransaction();

  foreach ($alumnosObjetivo as $idA) {
    $idA = (int)$idA;
    if ($idA <= 0) continue;

    $stExist->execute([
      ':id_alumno' => $idA,
      ':anio'      => $anioAplicado,
    ]);
    $existentes = $stExist->fetchAll(PDO::FETCH_ASSOC);

    $yaPorMes = [];
    foreach ($existentes as $row) {
      $yaPorMes[(int)$row['id_mes']] = (string)$row['estado'];
    }

    $insertadosAlumno    = 0;
    $yaRegistradosAlumno = [];

    // 8.1 meses 1..12
    foreach ($montosPorMes as $mes => $monto) {
      $mes = (int)$mes;
      if ($mes < 1 || $mes > 12) continue;

      if (array_key_exists($mes, $yaPorMes)) {
        $yaRegistradosAlumno[] = ['periodo' => $mes, 'estado' => $yaPorMes[$mes]];
        continue;
      }

      $montoFinal = $condonar ? 0 : max(0, (int)$monto);

      $stIns->execute([
        ':id_alumno'     => $idA,
        ':id_mes'        => $mes,
        ':anio_aplicado' => $anioAplicado,
        ':fecha_pago'    => $fechaPago,
        ':estado'        => $estadoRegistrar,
        ':monto_pago'    => $montoFinal,
        ':id_medio_pago' => ($idMedioPago && $idMedioPago > 0) ? $idMedioPago : null,
      ]);

      $insertadosAlumno++;
      $totalInsertados++;
    }

    // 8.2 matrícula (14)
    if ($matriculaSel) {
      $mesMat = 14;

      if (array_key_exists($mesMat, $yaPorMes)) {
        $yaRegistradosAlumno[] = ['periodo' => $mesMat, 'estado' => $yaPorMes[$mesMat]];
      } else {
        $montoMatricula = $resolverMonto($condonar, $montoUI, $montoLibre, $montosPorPeriodo, $mesMat);
        $montoMatricula = $condonar ? 0 : max(0, (int)$montoMatricula);

        $stIns->execute([
          ':id_alumno'     => $idA,
          ':id_mes'        => $mesMat,
          ':anio_aplicado' => $anioAplicado,
          ':fecha_pago'    => $fechaPago,
          ':estado'        => $estadoRegistrar,
          ':monto_pago'    => $montoMatricula,
          ':id_medio_pago' => ($idMedioPago && $idMedioPago > 0) ? $idMedioPago : null,
        ]);

        $insertadosAlumno++;
        $totalInsertados++;
      }
    }

    // 8.3 anual/mitades (13,15,16)
    foreach ($segmentos as $seg) {
      $idMesSeg = (int)($seg['id_mes'] ?? 0);
      $montoSeg = (int)($seg['total'] ?? 0);
      if (!$idMesSeg) continue;

      if (array_key_exists($idMesSeg, $yaPorMes)) {
        $yaRegistradosAlumno[] = ['periodo' => $idMesSeg, 'estado' => $yaPorMes[$idMesSeg]];
        continue;
      }

      $montoFinalSeg = $condonar ? 0 : max(0, $montoSeg);

      $stIns->execute([
        ':id_alumno'     => $idA,
        ':id_mes'        => $idMesSeg,
        ':anio_aplicado' => $anioAplicado,
        ':fecha_pago'    => $fechaPago,
        ':estado'        => $estadoRegistrar,
        ':monto_pago'    => $montoFinalSeg,
        ':id_medio_pago' => ($idMedioPago && $idMedioPago > 0) ? $idMedioPago : null,
      ]);

      $insertadosAlumno++;
      $totalInsertados++;
    }

    $detallePorAlumno[] = [
      'id_alumno'      => $idA,
      'insertados'     => $insertadosAlumno,
      'ya_registrados' => $yaRegistradosAlumno,
    ];
  }

  $pdo->commit();

  if ($totalInsertados > 0) {
    echo json_encode([
      'exito'              => true,
      'insertados_total'   => $totalInsertados,
      'familia_aplicada'   => $aplicarFamilia && count($alumnosObjetivo) > 1,
      'alumnos_procesados' => count($alumnosObjetivo),
      'detalle_por_alumno' => $detallePorAlumno,
    ], JSON_UNESCAPED_UNICODE);
  } else {
    echo json_encode([
      'exito'              => false,
      'mensaje'            => 'No se insertaron registros (todos ya estaban cargados para ese año aplicado).',
      'familia_aplicada'   => $aplicarFamilia && count($alumnosObjetivo) > 1,
      'alumnos_procesados' => count($alumnosObjetivo),
      'detalle_por_alumno' => $detallePorAlumno,
    ], JSON_UNESCAPED_UNICODE);
  }

} catch (Throwable $e) {
  if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  http_response_code(200);
  echo json_encode([
    'exito'   => false,
    'mensaje' => 'Error al registrar pagos: ' . $e->getMessage(),
  ], JSON_UNESCAPED_UNICODE);
}