<?php
// ✅ REEMPLAZAR COMPLETO
// backend/modules/cuotas/registrar_pago.php

require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

const PORCENTAJE_COBRADOR = 15;
const FACTOR_COOPERADORA = 0.85;
const DESCRIPCION_COBRADOR = 'COBRADOR';

try {
  if (!($pdo instanceof PDO)) {
    throw new RuntimeException('Conexión PDO no disponible');
  }

  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  /* ==========================================================
     1) Leer payload
     ========================================================== */
  $payload = json_decode(file_get_contents('php://input'), true) ?: [];

  $idAlumno = isset($payload['id_alumno']) ? (int)$payload['id_alumno'] : 0;
  $periodos = isset($payload['periodos']) && is_array($payload['periodos']) ? $payload['periodos'] : [];
  $condonar = !empty($payload['condonar']);

  $anioAplicado = isset($payload['anio']) ? (int)$payload['anio'] : (int)date('Y');

  $idMedioPago = isset($payload['id_medio_pago']) && $payload['id_medio_pago'] !== ''
    ? (int)$payload['id_medio_pago']
    : null;

  $montoLibre = isset($payload['monto_libre']) ? (int)$payload['monto_libre'] : 0;
  $montoUI = isset($payload['monto_unitario']) ? (int)$payload['monto_unitario'] : null;

  $fechaPagoPayload = isset($payload['fecha_pago']) ? trim((string)$payload['fecha_pago']) : '';

  $montosPorPeriodo = [];

  if (!empty($payload['montos_por_periodo']) && is_array($payload['montos_por_periodo'])) {
    foreach ($payload['montos_por_periodo'] as $k => $v) {
      $kk = (int)$k;
      $vv = (int)$v;

      if ($kk > 0) {
        $montosPorPeriodo[$kk] = max(0, $vv);
      }
    }
  }

  /* ==========================================================
     2) Grupo familiar
     ========================================================== */
  $aplicarFamilia = !empty($payload['aplicar_a_familia']);
  $idsFamilia = [];

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
     3) Validaciones
     ========================================================== */
  if ($idAlumno <= 0) {
    echo json_encode([
      'exito' => false,
      'mensaje' => 'ID de alumno inválido',
    ], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if (empty($periodos)) {
    echo json_encode([
      'exito' => false,
      'mensaje' => 'No se enviaron períodos a registrar',
    ], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if ($anioAplicado < 2000 || $anioAplicado > 2100) {
    $anioAplicado = (int)date('Y');
  }

  $estadoRegistrar = $condonar ? 'condonado' : 'pagado';

  if (!$condonar && (!$idMedioPago || $idMedioPago <= 0)) {
    echo json_encode([
      'exito' => false,
      'mensaje' => 'Debés seleccionar un medio de pago.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
  }

  /* ==========================================================
     3.1) Resolver fecha de pago
     ========================================================== */
  if ($fechaPagoPayload !== '') {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaPagoPayload)) {
      echo json_encode([
        'exito' => false,
        'mensaje' => 'Fecha de pago inválida (formato)',
      ], JSON_UNESCAPED_UNICODE);
      exit;
    }

    [$yy, $mm, $dd] = array_map('intval', explode('-', $fechaPagoPayload));

    if (!checkdate($mm, $dd, $yy) || $yy < 2000 || $yy > 2100) {
      echo json_encode([
        'exito' => false,
        'mensaje' => 'Fecha de pago inválida',
      ], JSON_UNESCAPED_UNICODE);
      exit;
    }

    $fechaPago = sprintf('%04d-%02d-%02d', $yy, $mm, $dd);
  } else {
    $fechaPago = (new DateTime())->format('Y-m-d');
  }

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
    if ($condonar) {
      return 0;
    }

    if (
      isset($montosPorPeriodo[$periodo]) &&
      is_int($montosPorPeriodo[$periodo]) &&
      $montosPorPeriodo[$periodo] >= 0
    ) {
      return (int)$montosPorPeriodo[$periodo];
    }

    if (!is_null($montoUI) && $montoUI > 0) {
      return (int)$montoUI;
    }

    if ($montoLibre > 0) {
      return (int)$montoLibre;
    }

    return 0;
  };

  $parsearSeleccion = function (array $periodos, array $montosPorPeriodo, bool $condonar): array {
    $mesesExplicitos = [];
    $matricula = false;
    $segmentos = [];

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
          'total' => $condonar ? 0 : $total,
        ];
      }
    }

    ksort($mesesExplicitos);

    return [
      'mesesExplicitos' => array_keys($mesesExplicitos),
      'matricula' => $matricula,
      'segmentos' => $segmentos,
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

      if ($m < 1 || $m > 12) {
        continue;
      }

      $map[$m] = $resolverMonto(
        $condonar,
        $montoUI,
        $montoLibre,
        $montosPorPeriodo,
        $m
      );
    }

    ksort($map);

    return $map;
  };

  $obtenerIdDescripcionCobrador = function (PDO $pdo): int {
    $st = $pdo->prepare("
      SELECT id_cont_descripcion
        FROM contable_descripcion
       WHERE UPPER(TRIM(nombre_descripcion)) = :nombre
       LIMIT 1
    ");

    $st->execute([
      ':nombre' => DESCRIPCION_COBRADOR,
    ]);

    $id = (int)$st->fetchColumn();

    if ($id > 0) {
      return $id;
    }

    $stIns = $pdo->prepare("
      INSERT INTO contable_descripcion (nombre_descripcion)
      VALUES (:nombre)
    ");

    $stIns->execute([
      ':nombre' => DESCRIPCION_COBRADOR,
    ]);

    return (int)$pdo->lastInsertId();
  };

  $obtenerEsCobrador = function (PDO $pdo, int $idA): int {
    $st = $pdo->prepare("
      SELECT COALESCE(es_cobrador, 0)
        FROM alumnos
       WHERE id_alumno = :id_alumno
       LIMIT 1
    ");

    $st->execute([
      ':id_alumno' => $idA,
    ]);

    $valor = $st->fetchColumn();

    if ($valor === false) {
      throw new RuntimeException("No existe el alumno con ID {$idA}");
    }

    return (int)$valor;
  };

  /**
   * ✅ Egreso mensual del cobrador.
   *
   * Regla final:
   * - Si ya existe egreso de COBRADOR para ese mes:
   *   suma importe, conserva fecha original y conserva id_medio_pago original.
   *
   * - Si todavía no existe:
   *   crea el egreso con la fecha real del pago que disparó el primer registro
   *   y con el medio de pago seleccionado en ese primer pago.
   */
  $sumarEgresoCobradorMensual = function (
    PDO $pdo,
    int $idContDescripcion,
    string $fechaPago,
    float $importeComision,
    ?int $idMedioPagoSeleccionado
  ): void {
    if ($importeComision <= 0) {
      return;
    }

    $fechaObj = new DateTime($fechaPago);
    $anio = (int)$fechaObj->format('Y');
    $mes = (int)$fechaObj->format('m');

    // ✅ Fecha real del primer pago del cobrador.
    // NO usar más YYYY-MM-01.
    $fechaRegistro = $fechaPago;

    $stBuscar = $pdo->prepare("
      SELECT id_egreso, id_medio_pago, fecha
        FROM egresos
       WHERE id_cont_descripcion = :id_cont_descripcion
         AND YEAR(fecha) = :anio
         AND MONTH(fecha) = :mes
       ORDER BY id_egreso ASC
       LIMIT 1
    ");

    $stBuscar->execute([
      ':id_cont_descripcion' => $idContDescripcion,
      ':anio' => $anio,
      ':mes' => $mes,
    ]);

    $egresoExistente = $stBuscar->fetch(PDO::FETCH_ASSOC);

    if ($egresoExistente && (int)$egresoExistente['id_egreso'] > 0) {
      $idEgreso = (int)$egresoExistente['id_egreso'];

      $stUpd = $pdo->prepare("
        UPDATE egresos
           SET importe = importe + :importe
         WHERE id_egreso = :id_egreso
         LIMIT 1
      ");

      $stUpd->execute([
        ':importe' => $importeComision,
        ':id_egreso' => $idEgreso,
      ]);

      return;
    }

    $stIns = $pdo->prepare("
      INSERT INTO egresos (
        fecha,
        id_cont_categoria,
        id_cont_proveedor,
        comprobante,
        id_cont_descripcion,
        id_medio_pago,
        importe,
        comprobante_url
      )
      VALUES (
        :fecha,
        NULL,
        NULL,
        NULL,
        :id_cont_descripcion,
        :id_medio_pago,
        :importe,
        NULL
      )
    ");

    $stIns->execute([
      ':fecha' => $fechaRegistro,
      ':id_cont_descripcion' => $idContDescripcion,
      ':id_medio_pago' => ($idMedioPagoSeleccionado && $idMedioPagoSeleccionado > 0) ? $idMedioPagoSeleccionado : null,
      ':importe' => $importeComision,
    ]);
  };

  /* ==========================================================
     5) Interpretar selección
     ========================================================== */
  $seleccion = $parsearSeleccion($periodos, $montosPorPeriodo, $condonar);

  $mesesExplicitos = $seleccion['mesesExplicitos'];
  $matriculaSel = $seleccion['matricula'];
  $segmentos = $seleccion['segmentos'];

  $montosPorMes = $construirMontosMensuales(
    $mesesExplicitos,
    $montosPorPeriodo,
    $condonar,
    $montoUI,
    $montoLibre
  );

  /* ==========================================================
     6) Consultas base
     ========================================================== */
  $stExist = $pdo->prepare("
    SELECT id_mes, estado
      FROM pagos
     WHERE id_alumno = :id_alumno
       AND anio_aplicado = :anio
  ");

  $stIns = $pdo->prepare("
    INSERT INTO pagos (
      id_alumno,
      id_mes,
      anio_aplicado,
      fecha_pago,
      estado,
      monto_pago,
      id_medio_pago
    )
    VALUES (
      :id_alumno,
      :id_mes,
      :anio_aplicado,
      :fecha_pago,
      :estado,
      :monto_pago,
      :id_medio_pago
    )
  ");

  /* ==========================================================
     7) Alumnos objetivo
     ========================================================== */
  $alumnosObjetivo = [$idAlumno];

  if ($aplicarFamilia && !empty($idsFamilia)) {
    $set = [];

    foreach ($alumnosObjetivo as $idp) {
      $set[(int)$idp] = true;
    }

    foreach ($idsFamilia as $idf) {
      $set[(int)$idf] = true;
    }

    $alumnosObjetivo = array_map('intval', array_keys($set));
    sort($alumnosObjetivo);
  }

  /* ==========================================================
     8) Registrar
     ========================================================== */
  $totalInsertados = 0;
  $detallePorAlumno = [];
  $totalComisionCobrador = 0;
  $totalNetoCooperadora = 0;
  $totalBrutoOriginal = 0;

  $pdo->beginTransaction();

  $idDescripcionCobrador = $obtenerIdDescripcionCobrador($pdo);

  foreach ($alumnosObjetivo as $idA) {
    $idA = (int)$idA;

    if ($idA <= 0) {
      continue;
    }

    $esCobrador = $obtenerEsCobrador($pdo, $idA);

    $stExist->execute([
      ':id_alumno' => $idA,
      ':anio' => $anioAplicado,
    ]);

    $existentes = $stExist->fetchAll(PDO::FETCH_ASSOC);

    $yaPorMes = [];

    foreach ($existentes as $row) {
      $yaPorMes[(int)$row['id_mes']] = (string)$row['estado'];
    }

    $insertadosAlumno = 0;
    $yaRegistradosAlumno = [];
    $brutoAlumno = 0;
    $netoAlumno = 0;
    $comisionAlumno = 0;

    $registrarItem = function (
      int $idMes,
      int $montoBruto
    ) use (
      $pdo,
      $stIns,
      $fechaPago,
      $estadoRegistrar,
      $anioAplicado,
      $idMedioPago,
      $condonar,
      $idA,
      $esCobrador,
      $idDescripcionCobrador,
      $sumarEgresoCobradorMensual,
      &$insertadosAlumno,
      &$totalInsertados,
      &$brutoAlumno,
      &$netoAlumno,
      &$comisionAlumno,
      &$totalComisionCobrador,
      &$totalNetoCooperadora,
      &$totalBrutoOriginal
    ): void {
      $montoBruto = $condonar ? 0 : max(0, (int)$montoBruto);

      $montoComision = 0;
      $montoNeto = $montoBruto;

      if (!$condonar && $esCobrador === 1 && $montoBruto > 0) {
        $montoComision = (int)round($montoBruto * (PORCENTAJE_COBRADOR / 100));
        $montoNeto = (int)round($montoBruto * FACTOR_COOPERADORA);
      }

      $stIns->execute([
        ':id_alumno' => $idA,
        ':id_mes' => $idMes,
        ':anio_aplicado' => $anioAplicado,
        ':fecha_pago' => $fechaPago,
        ':estado' => $estadoRegistrar,
        ':monto_pago' => $montoNeto,
        ':id_medio_pago' => (!$condonar && $idMedioPago && $idMedioPago > 0) ? $idMedioPago : null,
      ]);

      if (!$condonar && $esCobrador === 1 && $montoComision > 0) {
        $sumarEgresoCobradorMensual(
          $pdo,
          $idDescripcionCobrador,
          $fechaPago,
          (float)$montoComision,
          ($idMedioPago && $idMedioPago > 0) ? $idMedioPago : null
        );
      }

      $insertadosAlumno++;
      $totalInsertados++;

      $brutoAlumno += $montoBruto;
      $netoAlumno += $montoNeto;
      $comisionAlumno += $montoComision;

      $totalBrutoOriginal += $montoBruto;
      $totalNetoCooperadora += $montoNeto;
      $totalComisionCobrador += $montoComision;
    };

    foreach ($montosPorMes as $mes => $monto) {
      $mes = (int)$mes;

      if ($mes < 1 || $mes > 12) {
        continue;
      }

      if (array_key_exists($mes, $yaPorMes)) {
        $yaRegistradosAlumno[] = [
          'periodo' => $mes,
          'estado' => $yaPorMes[$mes],
        ];

        continue;
      }

      $registrarItem($mes, (int)$monto);
    }

    if ($matriculaSel) {
      $mesMat = 14;

      if (array_key_exists($mesMat, $yaPorMes)) {
        $yaRegistradosAlumno[] = [
          'periodo' => $mesMat,
          'estado' => $yaPorMes[$mesMat],
        ];
      } else {
        $montoMatricula = $resolverMonto(
          $condonar,
          $montoUI,
          $montoLibre,
          $montosPorPeriodo,
          $mesMat
        );

        $registrarItem($mesMat, (int)$montoMatricula);
      }
    }

    foreach ($segmentos as $seg) {
      $idMesSeg = (int)($seg['id_mes'] ?? 0);
      $montoSeg = (int)($seg['total'] ?? 0);

      if (!$idMesSeg) {
        continue;
      }

      if (array_key_exists($idMesSeg, $yaPorMes)) {
        $yaRegistradosAlumno[] = [
          'periodo' => $idMesSeg,
          'estado' => $yaPorMes[$idMesSeg],
        ];

        continue;
      }

      $registrarItem($idMesSeg, $montoSeg);
    }

    $detallePorAlumno[] = [
      'id_alumno' => $idA,
      'es_cobrador' => $esCobrador,
      'insertados' => $insertadosAlumno,
      'monto_bruto_original' => $brutoAlumno,
      'monto_neto_cooperadora' => $netoAlumno,
      'monto_comision_cobrador' => $comisionAlumno,
      'ya_registrados' => $yaRegistradosAlumno,
    ];
  }

  $pdo->commit();

  if ($totalInsertados > 0) {
    echo json_encode([
      'exito' => true,
      'mensaje' => 'Pago registrado correctamente.',
      'insertados_total' => $totalInsertados,
      'familia_aplicada' => $aplicarFamilia && count($alumnosObjetivo) > 1,
      'alumnos_procesados' => count($alumnosObjetivo),
      'fecha_pago_usada' => $fechaPago,
      'id_medio_pago_seleccionado' => (!$condonar && $idMedioPago && $idMedioPago > 0) ? $idMedioPago : null,
      'monto_bruto_original' => $totalBrutoOriginal,
      'monto_neto_cooperadora' => $totalNetoCooperadora,
      'monto_comision_cobrador' => $totalComisionCobrador,
      'porcentaje_cobrador' => PORCENTAJE_COBRADOR,
      'egreso_cobrador' => [
        'descripcion' => DESCRIPCION_COBRADOR,
        'id_medio_pago_usado_al_crear' => (!$condonar && $idMedioPago && $idMedioPago > 0) ? $idMedioPago : null,
        'nota' => 'Si el egreso mensual ya existía, solo se sumó el importe y se conservaron la fecha y el medio de pago que ya tenía.',
        'importe_sumado' => $totalComisionCobrador,
        'comprobante' => null,
      ],
      'detalle_por_alumno' => $detallePorAlumno,
    ], JSON_UNESCAPED_UNICODE);
  } else {
    echo json_encode([
      'exito' => false,
      'mensaje' => 'No se insertaron registros (todos ya estaban cargados para ese año aplicado).',
      'familia_aplicada' => $aplicarFamilia && count($alumnosObjetivo) > 1,
      'alumnos_procesados' => count($alumnosObjetivo),
      'fecha_pago_usada' => $fechaPago,
      'detalle_por_alumno' => $detallePorAlumno,
    ], JSON_UNESCAPED_UNICODE);
  }

} catch (Throwable $e) {
  if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
    $pdo->rollBack();
  }

  http_response_code(200);

  echo json_encode([
    'exito' => false,
    'mensaje' => 'Error al registrar pagos: ' . $e->getMessage(),
  ], JSON_UNESCAPED_UNICODE);
}