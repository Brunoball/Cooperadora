<?php
/**
 * /api.php?action=contable_ingresos
 *
 * Parámetros opcionales:
 * - year=YYYY
 * - month=MM   (1..12; si no viene, devuelve todo el año)
 * - detalle=1  (adjunta listado detallado de pagos del período)
 *
 * Reglas:
 * - Suma sólo pagos con estado = 'pagado'.
 * - El importe se toma SIEMPRE de pagos.monto_pago.
 * - Agrupa por YEAR(fecha_pago), MONTH(p.fecha_pago).
 */

header('Content-Type: application/json; charset=utf-8');

try {
  // Conexión (sin prefijos de base; db.php ya define $pdo y el esquema por defecto)
  if (!isset($pdo)) {
    require_once __DIR__ . '/../../config/db.php';
  }
  if (!($pdo instanceof PDO)) {
    throw new RuntimeException('Conexión PDO no disponible.');
  }
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  $year        = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
  $month       = isset($_GET['month']) ? (int)$_GET['month'] : 0;
  $wantDetalle = isset($_GET['detalle']) ? ((int)$_GET['detalle'] === 1) : false;

  $params = [':y' => $year];
  $where  = "p.estado = 'pagado' AND YEAR(p.fecha_pago) = :y";
  if ($month >= 1 && $month <= 12) {
    $where .= " AND MONTH(p.fecha_pago) = :m";
    $params[':m'] = $month;
  }

  // Catálogo de meses (por si querés usarlo desde acá)
  $stMeses = $pdo->query("SELECT id_mes, nombre FROM meses ORDER BY id_mes ASC");
  $mesesCatalogo = $stMeses->fetchAll(PDO::FETCH_ASSOC);

  // Años disponibles (sólo donde hay pagos 'pagado')
  $stAnios = $pdo->query("
    SELECT DISTINCT YEAR(fecha_pago) AS anio
    FROM pagos
    WHERE estado = 'pagado'
    ORDER BY anio DESC
  ");
  $aniosDisponibles = array_map(static fn($r) => (int)$r['anio'], $stAnios->fetchAll(PDO::FETCH_ASSOC));

  // Consulta principal:
  // - mf: nombre del mes calendario (por fecha_pago)
  // - mp: nombre del mes pagado (por id_mes de la fila pagos)
  $sql = "
    SELECT
      p.id_pago,
      p.id_alumno,
      p.id_mes,
      p.fecha_pago,
      p.estado,
      p.monto_pago,
      a.apellido,
      a.nombre,
      a.id_categoria,
      c.nombre_categoria,
      mf.nombre AS nombre_mes_calendario,
      mp.nombre AS nombre_mes_pagado,
      YEAR(p.fecha_pago)  AS anio,
      MONTH(p.fecha_pago) AS mes
    FROM pagos p
    INNER JOIN alumnos a
      ON a.id_alumno = p.id_alumno
    LEFT JOIN categoria c
      ON c.id_categoria = a.id_categoria
    LEFT JOIN meses mp
      ON mp.id_mes = p.id_mes
    LEFT JOIN meses mf
      ON mf.id_mes = MONTH(p.fecha_pago)
    WHERE $where
    ORDER BY p.fecha_pago ASC, p.id_pago ASC
  ";

  $st = $pdo->prepare($sql);
  $st->execute($params);
  $rows = $st->fetchAll(PDO::FETCH_ASSOC);

  $totalesMes = [];   // key "YYYY-MM" => {anio, mes, nombre_mes, ingresos, cantidad, categorias:[]}
  $detalleMes = [];   // key "YYYY-MM" => [ { ... }, ... ]
  $catMes     = [];   // key "YYYY-MM" => [ 'CAT' => {monto, cantidad}, ... ]

  foreach ($rows as $r) {
    $anio = (int)$r['anio'];
    $mes  = (int)$r['mes'];
    $key  = sprintf('%04d-%02d', $anio, $mes);

    // Importe: siempre el guardado en pagos.monto_pago
    $monto = (int)($r['monto_pago'] ?? 0);

    if (!isset($totalesMes[$key])) {
      $totalesMes[$key] = [
        'anio'       => $anio,
        'mes'        => $mes,
        // nombre del mes calendario viene de la tabla meses (mf)
        'nombre_mes' => (string)($r['nombre_mes_calendario'] ?? ''),
        'ingresos'   => 0,
        'cantidad'   => 0,
        'categorias' => []
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
        'id_pago'       => (int)$r['id_pago'],
        'fecha_pago'    => $r['fecha_pago'],
        'Alumno'        => trim(($r['apellido'] ?? '') . ', ' . ($r['nombre'] ?? '')),
        'Categoria'     => $cat,
        'Monto'         => $monto,
        'Mes_pagado_id' => (int)$r['id_mes'],
        // nombre del mes pagado viene de la tabla meses (mp)
        'Mes_pagado'    => (string)($r['nombre_mes_pagado'] ?? ''),
      ];
    }
  }

  // Pasar categorías al resumen
  foreach ($totalesMes as $k => &$res) {
    if (!empty($catMes[$k])) {
      foreach ($catMes[$k] as $nombre => $agg) {
        $res['categorias'][] = [
          'nombre'   => $nombre,
          'monto'    => (int)$agg['monto'],
          'cantidad' => (int)$agg['cantidad']
        ];
      }
      usort($res['categorias'], fn($a, $b) => $b['monto'] <=> $a['monto']);
    }
  }
  ksort($totalesMes);

  $payload = [
    'exito'             => true,
    'filtros'           => ['year' => $year, 'month' => $month],
    'resumen'           => array_values($totalesMes),
    'detalle'           => $wantDetalle ? $detalleMes : (object)[],
    'meses_catalogo'    => $mesesCatalogo,     // opcional para el front
    'anios_disponibles' => $aniosDisponibles,  // años para el select
  ];

  echo json_encode($payload, JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode([
    'exito'   => false,
    'mensaje' => 'Error: ' . $e->getMessage()
  ], JSON_UNESCAPED_UNICODE);
}
