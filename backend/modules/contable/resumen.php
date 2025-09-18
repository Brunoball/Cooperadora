<?php
/**
 * /api.php?action=contable_resumen
 * GET: ?year=YYYY
 * Devuelve por mes: ingresos (pagos + ingresos manuales), egresos y saldo.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

try {
  if (!isset($pdo)) {
    require_once __DIR__ . '/../../config/db.php';
  }
  if (!($pdo instanceof PDO)) {
    throw new RuntimeException('Conexión PDO no disponible.');
  }
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->exec("SET NAMES utf8mb4");

  $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');

  /* 1) Ingresos desde PAGOS (usa el módulo existente contable/ingresos.php) */
  $GET_bak = $_GET;
  $_GET = ['action' => 'contable_ingresos', 'year' => $year];
  ob_start();
  require __DIR__ . '/ingresos.php';
  $ingRaw = ob_get_clean();
  $_GET = $GET_bak;

  $ingresosMes = [];
  $ing = json_decode($ingRaw, true);
  if (is_array($ing) && !empty($ing['resumen'])) {
    foreach ($ing['resumen'] as $r) {
      $key = sprintf('%04d-%02d', (int)$r['anio'], (int)$r['mes']);
      $ingresosMes[$key] = (float)$r['ingresos']; // sólo pagos
    }
  }

  /* 2) Ingresos MANUALES (tabla ingresos) */
  $stMan = $pdo->prepare("
    SELECT YEAR(fecha) AS y, MONTH(fecha) AS m, SUM(importe) AS total
    FROM ingresos
    WHERE YEAR(fecha) = :y
    GROUP BY y, m
    ORDER BY y, m
  ");
  $stMan->execute([':y' => $year]);
  while ($r = $stMan->fetch(PDO::FETCH_ASSOC)) {
    $key = sprintf('%04d-%02d', (int)$r['y'], (int)$r['m']);
    $ingresosMes[$key] = ($ingresosMes[$key] ?? 0) + (float)$r['total']; // pagos + manuales
  }

  /* 3) Egresos */
  $stE = $pdo->prepare("
    SELECT YEAR(fecha) AS y, MONTH(fecha) AS m, SUM(monto) AS total
    FROM egresos
    WHERE YEAR(fecha) = :y
    GROUP BY y, m
    ORDER BY y, m
  ");
  $stE->execute([':y' => $year]);
  $egresosMes = [];
  while ($r = $stE->fetch(PDO::FETCH_ASSOC)) {
    $key = sprintf('%04d-%02d', (int)$r['y'], (int)$r['m']);
    $egresosMes[$key] = (float)$r['total'];
  }

  /* 4) Salida normalizada a 12 meses */
  $MESES = [
    1=>'ENERO',2=>'FEBRERO',3=>'MARZO',4=>'ABRIL',5=>'MAYO',6=>'JUNIO',
    7=>'JULIO',8=>'AGOSTO',9=>'SEPTIEMBRE',10=>'OCTUBRE',11=>'NOVIEMBRE',12=>'DICIEMBRE'
  ];

  $out = [];
  for ($m = 1; $m <= 12; $m++) {
    $key   = sprintf('%04d-%02d', $year, $m);
    $ingV  = (float)($ingresosMes[$key] ?? 0);
    $egrV  = (float)($egresosMes[$key] ?? 0);
    $out[] = [
      'anio'        => $year,
      'mes'         => $m,
      'nombre_mes'  => $MESES[$m],
      'ingresos'    => $ingV,
      'egresos'     => $egrV,
      'saldo'       => $ingV - $egrV,
    ];
  }

  echo json_encode(['exito' => true, 'year' => $year, 'resumen' => $out], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
