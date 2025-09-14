<?php
/**
 * /api.php?action=contable_egresos
 *
 * Métodos por parámetro 'op':
 *  - op=list   [GET]    ?start=YYYY-MM-DD&end=YYYY-MM-DD&categoria=...&medio=...
 *  - op=create [POST]   body JSON: {fecha, categoria, descripcion, medio_pago, monto, comprobante_url?}
 *  - op=update [POST]   body JSON: {id_egreso, ...campos...}
 *  - op=delete [POST]   body JSON: {id_egreso}
 *  - op=resumen[GET]    Totales por mes (ingresos/egresos/saldo). Usa contable_ingresos internamente.
 */

header('Content-Type: application/json; charset=utf-8');
if (!isset($pdo)) {
  require_once __DIR__ . '/../../config/db.php';
}
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

function json_input() {
  $raw = file_get_contents('php://input');
  if (!$raw) return [];
  $obj = json_decode($raw, true);
  return is_array($obj) ? $obj : [];
}

try {
  $op = $_GET['op'] ?? 'list';

  if ($op === 'create') {
    $in = json_input();
    $sql = "INSERT INTO egresos (fecha, categoria, descripcion, medio_pago, monto, comprobante_url)
            VALUES (:fecha,:categoria,:descripcion,:medio,:monto,:comp)";
    $st = $pdo->prepare($sql);
    $st->execute([
      ':fecha'      => $in['fecha'] ?? date('Y-m-d'),
      ':categoria'  => trim($in['categoria'] ?? 'SIN CATEGORÍA'),
      ':descripcion'=> trim($in['descripcion'] ?? null),
      ':medio'      => $in['medio_pago'] ?? 'efectivo',
      ':monto'      => (int)($in['monto'] ?? 0),
      ':comp'       => $in['comprobante_url'] ?? null,
    ]);
    echo json_encode(['exito'=>true, 'id_egreso' => (int)$pdo->lastInsertId()], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if ($op === 'update') {
    $in = json_input();
    $id = (int)($in['id_egreso'] ?? 0);
    if ($id <= 0) throw new InvalidArgumentException('id_egreso inválido');

    $sql = "UPDATE egresos SET
              fecha=:fecha, categoria=:categoria, descripcion=:descripcion,
              medio_pago=:medio, monto=:monto, comprobante_url=:comp
            WHERE id_egreso=:id";
    $st = $pdo->prepare($sql);
    $st->execute([
      ':id'         => $id,
      ':fecha'      => $in['fecha'] ?? date('Y-m-d'),
      ':categoria'  => trim($in['categoria'] ?? 'SIN CATEGORÍA'),
      ':descripcion'=> trim($in['descripcion'] ?? null),
      ':medio'      => $in['medio_pago'] ?? 'efectivo',
      ':monto'      => (int)($in['monto'] ?? 0),
      ':comp'       => $in['comprobante_url'] ?? null,
    ]);
    echo json_encode(['exito'=>true], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if ($op === 'delete') {
    $in = json_input();
    $id = (int)($in['id_egreso'] ?? 0);
    if ($id <= 0) throw new InvalidArgumentException('id_egreso inválido');

    $st = $pdo->prepare("DELETE FROM egresos WHERE id_egreso=:id");
    $st->execute([':id'=>$id]);
    echo json_encode(['exito'=>true], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if ($op === 'resumen') {
    // Resumen mensual: ingresos (desde contable_ingresos), egresos y saldo
    $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');

    // Ingresos por mes
    $ingreq = $_GET;
    $ingreq['action'] = 'contable_ingresos';
    $_GET_bak = $_GET;
    $_GET = ['action'=>'contable_ingresos','year'=>$year]; // sin month => todo el año
    ob_start();
    require __DIR__.'/ingresos.php';
    $ingRaw = ob_get_clean();
    $_GET = $_GET_bak;

    $ing = json_decode($ingRaw, true);
    $ingresosMes = []; // "YYYY-MM" => monto
    if (is_array($ing) && !empty($ing['resumen'])) {
      foreach ($ing['resumen'] as $r) {
        $key = sprintf('%04d-%02d', (int)$r['anio'], (int)$r['mes']);
        $ingresosMes[$key] = (int)$r['ingresos'];
      }
    }

    // Egresos por mes
    $st = $pdo->prepare("SELECT YEAR(fecha) y, MONTH(fecha) m, SUM(monto) monto
                         FROM egresos
                         WHERE YEAR(fecha)=:y
                         GROUP BY y,m ORDER BY y,m");
    $st->execute([':y'=>$year]);
    $egresosMes = [];
    while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
      $key = sprintf('%04d-%02d', (int)$r['y'], (int)$r['m']);
      $egresosMes[$key] = (int)$r['monto'];
    }

    // Merge
    $MESES = [1=>'ENERO',2=>'FEBRERO',3=>'MARZO',4=>'ABRIL',5=>'MAYO',6=>'JUNIO',7=>'JULIO',8=>'AGOSTO',9=>'SEPTIEMBRE',10=>'OCTUBRE',11=>'NOVIEMBRE',12=>'DICIEMBRE'];
    $out = [];
    for ($m=1;$m<=12;$m++){
      $key = sprintf('%04d-%02d', $year, $m);
      $ing = $ingresosMes[$key] ?? 0;
      $egr = $egresosMes[$key] ?? 0;
      $out[] = [
        'anio' => $year,
        'mes'  => $m,
        'nombre_mes' => $MESES[$m],
        'ingresos' => $ing,
        'egresos'  => $egr,
        'saldo'    => $ing - $egr
      ];
    }
    echo json_encode(['exito'=>true, 'year'=>$year, 'resumen'=>$out], JSON_UNESCAPED_UNICODE);
    exit;
  }

  // op=list (default)
  $start = $_GET['start'] ?? null; // YYYY-MM-DD
  $end   = $_GET['end']   ?? null;
  $cat   = trim($_GET['categoria'] ?? '');
  $medio = trim($_GET['medio'] ?? '');

  $where = "1=1";
  $par   = [];
  if ($start && $end) {
    $where .= " AND fecha BETWEEN :s AND :e";
    $par[':s'] = $start;
    $par[':e'] = $end;
  } elseif ($start) {
    $where .= " AND fecha >= :s";
    $par[':s'] = $start;
  } elseif ($end) {
    $where .= " AND fecha <= :e";
    $par[':e'] = $end;
  }
  if ($cat !== '') {
    $where .= " AND categoria = :c";
    $par[':c'] = $cat;
  }
  if ($medio !== '') {
    $where .= " AND medio_pago = :m";
    $par[':m'] = $medio;
  }

  $sql = "SELECT * FROM egresos WHERE $where ORDER BY fecha DESC, id_egreso DESC";
  $st = $pdo->prepare($sql);
  $st->execute($par);
  $list = $st->fetchAll(PDO::FETCH_ASSOC);

  $total = 0;
  foreach ($list as $r) $total += (int)$r['monto'];

  echo json_encode(['exito'=>true, 'total'=>$total, 'datos'=>$list], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['exito'=>false, 'mensaje'=>'Error: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
}
