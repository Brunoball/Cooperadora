<?php
/**
 * /api.php?action=contable_resumen&year=YYYY
 * Suma ingresos de alumnos (pagos) + ingresos manuales, resta egresos.
 * Devuelve 12 filas (enero..diciembre) con ingresos, egresos y saldo.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

try {
  // ===== Conexión =====
  if (!isset($pdo)) {
    require_once __DIR__ . '/../../config/db.php';
  }
  if (!($pdo instanceof PDO)) {
    throw new RuntimeException('Conexión PDO no disponible.');
  }
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->exec("SET NAMES utf8mb4");

  $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
  if ($year < 2000 || $year > 2100) $year = (int)date('Y');

  /* ==========================================================
     1) PAGOS (alumnos)  -> SUM(monto_pago) cuando estado='pagado'
     ========================================================== */
  $stPagos = $pdo->prepare("
    SELECT
      YEAR(fecha_pago)   AS y,
      MONTH(fecha_pago)  AS m,
      SUM(CASE WHEN estado = 'pagado' THEN COALESCE(monto_pago,0) ELSE 0 END) AS total
    FROM pagos
    WHERE YEAR(fecha_pago) = :y
    GROUP BY y, m
    ORDER BY y, m
  ");
  $stPagos->execute([':y' => $year]);

  $ingresosPagosMes = [];
  while ($r = $stPagos->fetch(PDO::FETCH_ASSOC)) {
    $y = (int)$r['y']; $m = (int)$r['m'];
    if ($y === $year && $m >= 1 && $m <= 12) {
      $key = sprintf('%04d-%02d', $y, $m);
      $ingresosPagosMes[$key] = (float)$r['total'];
    }
  }

  /* ==========================================================
     2) INGRESOS MANUALES (tabla ingresos) -> SUM(importe)
     ========================================================== */
  $stIngMan = $pdo->prepare("
    SELECT
      YEAR(fecha)   AS y,
      MONTH(fecha)  AS m,
      SUM(COALESCE(importe,0)) AS total
    FROM ingresos
    WHERE YEAR(fecha) = :y
    GROUP BY y, m
    ORDER BY y, m
  ");
  $stIngMan->execute([':y' => $year]);

  $ingresosManualesMes = [];
  while ($r = $stIngMan->fetch(PDO::FETCH_ASSOC)) {
    $y = (int)$r['y']; $m = (int)$r['m'];
    if ($y === $year && $m >= 1 && $m <= 12) {
      $key = sprintf('%04d-%02d', $y, $m);
      $ingresosManualesMes[$key] = (float)$r['total'];
    }
  }

  /* ==========================================================
     3) EGRESOS (tabla egresos) -> SUM(importe)
     ========================================================== */
  $stEgr = $pdo->prepare("
    SELECT
      YEAR(fecha)   AS y,
      MONTH(fecha)  AS m,
      SUM(COALESCE(importe,0)) AS total
    FROM egresos
    WHERE YEAR(fecha) = :y
    GROUP BY y, m
    ORDER BY y, m
  ");
  $stEgr->execute([':y' => $year]);

  $egresosMes = [];
  while ($r = $stEgr->fetch(PDO::FETCH_ASSOC)) {
    $y = (int)$r['y']; $m = (int)$r['m'];
    if ($y === $year && $m >= 1 && $m <= 12) {
      $key = sprintf('%04d-%02d', $y, $m);
      $egresosMes[$key] = (float)$r['total'];
    }
  }

  /* ==========================================================
     4) Normalizar a 12 meses y combinar
     ========================================================== */
  $MESES = [
    1=>'ENERO',2=>'FEBRERO',3=>'MARZO',4=>'ABRIL',5=>'MAYO',6=>'JUNIO',
    7=>'JULIO',8=>'AGOSTO',9=>'SEPTIEMBRE',10=>'OCTUBRE',11=>'NOVIEMBRE',12=>'DICIEMBRE'
  ];

  $out = [];
  for ($m = 1; $m <= 12; $m++) {
    $key       = sprintf('%04d-%02d', $year, $m);
    $ingPagos  = (float)($ingresosPagosMes[$key]    ?? 0);
    $ingMan    = (float)($ingresosManualesMes[$key] ?? 0);
    $ingTotal  = $ingPagos + $ingMan;
    $egrTotal  = (float)($egresosMes[$key] ?? 0);

    $out[] = [
      'anio'            => $year,
      'mes'             => $m,
      'nombre_mes'      => $MESES[$m],
      'ingresos'        => $ingTotal,          // 👈 Pagos + Manuales
      'egresos'         => $egrTotal,
      'saldo'           => $ingTotal - $egrTotal,
      // breakdown opcional (útil para debug / auditoría)
      'ingresos_pagos'  => $ingPagos,
      'ingresos_manual' => $ingMan,
    ];
  }

  echo json_encode([
    'exito'   => true,
    'year'    => $year,
    'resumen' => $out,
  ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(200);
  echo json_encode([
    'exito'   => false,
    'mensaje' => 'Error: ' . $e->getMessage(),
  ], JSON_UNESCAPED_UNICODE);
}
