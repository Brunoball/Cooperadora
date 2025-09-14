<?php
/**
 * /api.php?action=contable_ingresos
 *
 * Parámetros opcionales:
 * - year=YYYY  (por defecto: año actual)
 * - month=MM   (1..12; si no viene, devuelve todo el año agrupado por mes)
 * - detalle=1  (si viene, adjunta listado detallado de pagos del período)
 *
 * Reglas:
 * - estado = 'pagado' suma; 'condonado' no suma.
 * - Monto = pagos.libre (si >0) o categoria.monto.
 * - Agrupación base por fecha de pago (YEAR(fecha_pago), MONTH(fecha_pago)).
 */

header('Content-Type: application/json; charset=utf-8');
if (!isset($pdo)) {
  require_once __DIR__ . '/../../config/db.php';
}
try {
  if (!($pdo instanceof PDO)) {
    throw new RuntimeException('Conexión PDO no disponible.');
  }
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  $year  = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
  $month = isset($_GET['month']) ? (int)$_GET['month'] : 0;
  $wantDetalle = isset($_GET['detalle']) ? (int)$_GET['detalle'] === 1 : false;

  $params = [':y' => $year];
  $where  = "p.estado = 'pagado' AND YEAR(p.fecha_pago) = :y";
  if ($month >= 1 && $month <= 12) {
    $where .= " AND MONTH(p.fecha_pago) = :m";
    $params[':m'] = $month;
  }

  // Traigo pagos con info de alumno y categoría
  $sql = "
    SELECT
      p.id_pago, p.id_alumno, p.id_mes,
      p.fecha_pago, p.estado, p.libre,
      a.apellido, a.nombre, a.id_categoria,
      c.nombre_categoria, c.monto AS monto_categoria,
      YEAR(p.fecha_pago) AS anio, MONTH(p.fecha_pago) AS mes
    FROM pagos p
    INNER JOIN alumnos a ON a.id_alumno = p.id_alumno
    LEFT JOIN categoria c ON c.id_categoria = a.id_categoria
    WHERE $where
    ORDER BY p.fecha_pago ASC, p.id_pago ASC
  ";
  $st = $pdo->prepare($sql);
  $st->execute($params);
  $rows = $st->fetchAll(PDO::FETCH_ASSOC);

  // Helper nombre mes
  $MESES = [1=>'ENERO',2=>'FEBRERO',3=>'MARZO',4=>'ABRIL',5=>'MAYO',6=>'JUNIO',7=>'JULIO',8=>'AGOSTO',9=>'SEPTIEMBRE',10=>'OCTUBRE',11=>'NOVIEMBRE',12=>'DICIEMBRE'];

  // Armo agrupaciones y totales
  $totalesMes = [];   // key "YYYY-MM" => {anio, mes, nombre_mes, ingresos, cantidad}
  $detalleMes = [];   // key "YYYY-MM" => [ pagos... ]
  $catMes     = [];   // key "YYYY-MM" => { "CAT A": {monto, cantidad}, ... }

  foreach ($rows as $r) {
    $anio = (int)$r['anio'];
    $mes  = (int)$r['mes'];
    $key  = sprintf('%04d-%02d', $anio, $mes);

    $monto = (int)($r['libre'] ?? 0);
    if ($monto <= 0) {
      $monto = (int)($r['monto_categoria'] ?? 0);
    }

    if (!isset($totalesMes[$key])) {
      $totalesMes[$key] = [
        'anio'        => $anio,
        'mes'         => $mes,
        'nombre_mes'  => $MESES[$mes] ?? "MES $mes",
        'ingresos'    => 0,
        'cantidad'    => 0
      ];
    }
    $totalesMes[$key]['ingresos'] += $monto;
    $totalesMes[$key]['cantidad'] += 1;

    $cat = (string)($r['nombre_categoria'] ?? 'SIN CATEGORÍA');
    if (!isset($catMes[$key])) $catMes[$key] = [];
    if (!isset($catMes[$key][$cat])) $catMes[$key][$cat] = ['monto' => 0, 'cantidad' => 0];
    $catMes[$key][$cat]['monto']    += $monto;
    $catMes[$key][$cat]['cantidad'] += 1;

    if ($wantDetalle) {
      if (!isset($detalleMes[$key])) $detalleMes[$key] = [];
      $detalleMes[$key][] = [
        'id_pago'          => (int)$r['id_pago'],
        'fecha_pago'       => $r['fecha_pago'],
        'Alumno'           => trim(($r['apellido'] ?? '').', '.($r['nombre'] ?? '')),
        'Categoria'        => (string)($r['nombre_categoria'] ?? ''),
        'Monto'            => $monto,
        'Mes_pagado_id'    => (int)$r['id_mes'],
      ];
    }
  }

  // Orden cronológico
  ksort($totalesMes);

  // Empaquetado
  $resumen = array_values($totalesMes);
  foreach ($resumen as &$r) {
    $key = sprintf('%04d-%02d', $r['anio'], $r['mes']);
    $r['categorias'] = [];
    if (isset($catMes[$key])) {
      foreach ($catMes[$key] as $nom => $obj) {
        $r['categorias'][] = [
          'nombre'   => $nom,
          'monto'    => (int)$obj['monto'],
          'cantidad' => (int)$obj['cantidad']
        ];
      }
      usort($r['categorias'], fn($a,$b) => $b['monto'] <=> $a['monto']);
    }
  }

  $payload = [
    'exito'   => true,
    'filtros' => ['year' => $year, 'month' => $month],
    'resumen' => $resumen
  ];
  if ($wantDetalle) $payload['detalle'] = $detalleMes;

  echo json_encode($payload, JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['exito' => false, 'mensaje' => 'Error: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
}
