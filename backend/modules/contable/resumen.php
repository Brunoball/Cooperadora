<?php
/**
 * /api.php?action=contable_resumen&year=YYYY
 * Suma ingresos de alumnos (tabla pagos, estado='pagado') + ingresos manuales (tabla ingresos) y resta egresos (tabla egresos).
 * Devuelve SIEMPRE 12 filas (enero..diciembre).
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
/* 🔒 Desactivar cualquier caché intermedio */
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

try {
  // ===== Conexión =====
  if (!isset($pdo)) {
    require_once __DIR__ . '/../../config/db.php'; // debe crear $pdo (PDO)
  }
  if (!($pdo instanceof PDO)) {
    throw new RuntimeException('Conexión PDO no disponible.');
  }

  // Seguridad/consistencia lectura
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->exec("SET NAMES utf8mb4");
  $pdo->exec("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED");

  // Año
  $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
  if ($year < 2000 || $year > 2100) $year = (int)date('Y');

  // Helper: ¿existe tabla?
  $fnTableExists = function(PDO $pdo, string $table): bool {
    $stmt = $pdo->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t LIMIT 1");
    $stmt->execute([':t' => $table]);
    return (bool)$stmt->fetchColumn();
  };

  /* ==========================================================
     OBTENER TODOS LOS AÑOS DISPONIBLES DE LAS 3 TABLAS
     ========================================================== */
  $allYears = [];

  // Años de la tabla pagos
  if ($fnTableExists($pdo, 'pagos')) {
    $st = $pdo->query("SELECT DISTINCT YEAR(fecha_pago) as y FROM pagos WHERE fecha_pago IS NOT NULL ORDER BY y DESC");
    while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
      if (!empty($r['y'])) $allYears[] = (int)$r['y'];
    }
  }

  // Años de la tabla ingresos
  if ($fnTableExists($pdo, 'ingresos')) {
    $st = $pdo->query("SELECT DISTINCT YEAR(fecha) as y FROM ingresos WHERE fecha IS NOT NULL ORDER BY y DESC");
    while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
      if (!empty($r['y']) && !in_array((int)$r['y'], $allYears)) $allYears[] = (int)$r['y'];
    }
  }

  // Años de la tabla egresos
  if ($fnTableExists($pdo, 'egresos')) {
    $st = $pdo->query("SELECT DISTINCT YEAR(fecha) as y FROM egresos WHERE fecha IS NOT NULL ORDER BY y DESC");
    while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
      if (!empty($r['y']) && !in_array((int)$r['y'], $allYears)) $allYears[] = (int)$r['y'];
    }
  }

  // Si no hay años en las tablas, usar año actual
  if (empty($allYears)) {
    $allYears[] = (int)date('Y');
  }

  // Ordenar años de forma descendente
  rsort($allYears);

  /* ==========================================================
     1) PAGOS (alumnos) -> SUM(monto_pago) cuando estado='pagado'
     ========================================================== */
  $ingresosPagosMes = [];
  if ($fnTableExists($pdo, 'pagos')) {
    $st = $pdo->prepare("
      SELECT MONTH(fecha_pago) AS m,
             SUM(CASE WHEN estado='pagado' THEN COALESCE(monto_pago,0) ELSE 0 END) AS total
      FROM pagos
      WHERE YEAR(fecha_pago) = :y
      GROUP BY m
      ORDER BY m
    ");
    $st->execute([':y' => $year]);
    while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
      $m = (int)$r['m'];
      if ($m >= 1 && $m <= 12) $ingresosPagosMes[$m] = (float)$r['total'];
    }
  }

  /* ==========================================================
     2) INGRESOS MANUALES (tabla ingresos) -> SUM(importe)
     ========================================================== */
  $ingresosManualesMes = [];
  if ($fnTableExists($pdo, 'ingresos')) {
    $st = $pdo->prepare("
      SELECT MONTH(fecha) AS m,
             SUM(COALESCE(importe,0)) AS total
      FROM ingresos
      WHERE YEAR(fecha) = :y
      GROUP BY m
      ORDER BY m
    ");
    $st->execute([':y' => $year]);
    while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
      $m = (int)$r['m'];
      if ($m >= 1 && $m <= 12) $ingresosManualesMes[$m] = (float)$r['total'];
    }
  }

  /* ==========================================================
     3) EGRESOS (tabla egresos) -> SUM(importe)
     ========================================================== */
  $egresosMes = [];
  if ($fnTableExists($pdo, 'egresos')) {
    $st = $pdo->prepare("
      SELECT MONTH(fecha) AS m,
             SUM(COALESCE(importe,0)) AS total
      FROM egresos
      WHERE YEAR(fecha) = :y
      GROUP BY m
      ORDER BY m
    ");
    $st->execute([':y' => $year]);
    while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
      $m = (int)$r['m'];
      if ($m >= 1 && $m <= 12) $egresosMes[$m] = (float)$r['total'];
    }
  }

  /* ==========================================================
     4) Normalizar a 12 meses y combinar
     ========================================================== */
  $MESES = [1=>'ENERO',2=>'FEBRERO',3=>'MARZO',4=>'ABRIL',5=>'MAYO',6=>'JUNIO',7=>'JULIO',8=>'AGOSTO',9=>'SEPTIEMBRE',10=>'OCTUBRE',11=>'NOVIEMBRE',12=>'DICIEMBRE'];

  $out = [];
  for ($m = 1; $m <= 12; $m++) {
    $ingPagos = (float)($ingresosPagosMes[$m]    ?? 0.0);
    $ingMan   = (float)($ingresosManualesMes[$m] ?? 0.0);
    $egr      = (float)($egresosMes[$m]          ?? 0.0);
    $ingTot   = $ingPagos + $ingMan;

    // Defensa extra por si hay strings tipo "20.000" o "$ 20.000"
    // (MySQL suele castear OK, pero por las dudas normalizamos)
    $ingTot = (float)number_format($ingTot, 2, '.', '');
    $egr    = (float)number_format($egr, 2, '.', '');

    $out[] = [
      'anio'            => $year,
      'mes'             => $m,
      'nombre_mes'      => $MESES[$m],
      'ingresos'        => $ingTot,
      'egresos'         => $egr,
      'saldo'           => $ingTot - $egr,
      // 👇 breakdown para auditar en el front si lo necesitás
      'ingresos_pagos'  => $ingPagos,
      'ingresos_manual' => $ingMan,
    ];
  }

  echo json_encode([
    'exito'   => true,
    'year'    => $year,
    'resumen' => $out,
    'anios_disponibles' => $allYears, // ← AÑOS DISPONIBLES PARA EL SELECTOR
  ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(200);
  echo json_encode([
    'exito'   => false,
    'mensaje' => 'Error: ' . $e->getMessage(),
    'anios_disponibles' => [(int)date('Y')], // ← Valor por defecto en caso de error
  ], JSON_UNESCAPED_UNICODE);
}