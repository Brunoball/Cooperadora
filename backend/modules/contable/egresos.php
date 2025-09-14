<?php
/**
 * /api.php?action=contable_egresos
 *
 * Métodos por parámetro 'op':
 *  - op=list   [GET]    ?start=YYYY-MM-DD&end=YYYY-MM-DD&categoria=...&medio=...
 *                       (medio puede ser ID numérico o nombre)
 *  - op=create [POST]   JSON: {fecha, categoria, descripcion, id_medio_pago, monto, comprobante_url?}
 *                       (compat: si viene medio_pago en texto y no id_medio_pago, se resuelve el id)
 *  - op=update [POST]   JSON: {id_egreso, ...campos...}
 *  - op=delete [POST]   JSON: {id_egreso}
 *  - op=resumen[GET]    Totales por mes (ingresos/egresos/saldo)
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
if (!isset($pdo)) {
  require_once __DIR__ . '/../../config/db.php';
}
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec("SET NAMES utf8mb4");

function json_input(): array {
  $raw = file_get_contents('php://input');
  if (!$raw) return [];
  $obj = json_decode($raw, true);
  return is_array($obj) ? $obj : [];
}

/** Resuelve un id_medio_pago a partir de id directo o nombre (UPPER). */
function resolver_id_medio_pago(PDO $pdo, $id, $nombre): int {
  $id = is_numeric($id) ? (int)$id : 0;
  if ($id > 0) return $id;

  $nom = strtoupper(trim((string)$nombre));
  if ($nom === '') throw new InvalidArgumentException('id_medio_pago o medio_pago requerido.');

  $st = $pdo->prepare("SELECT id_medio_pago FROM medio_pago WHERE UPPER(medio_pago)=:n LIMIT 1");
  $st->execute([':n' => $nom]);
  $found = $st->fetchColumn();
  if ($found) return (int)$found;

  // Último recurso: usar OTRO si existe.
  $st = $pdo->query("SELECT id_medio_pago FROM medio_pago WHERE UPPER(medio_pago)='OTRO' LIMIT 1");
  $otro = $st->fetchColumn();
  if ($otro) return (int)$otro;

  // Crear OTRO si no existe.
  $pdo->prepare("INSERT INTO medio_pago (medio_pago) VALUES ('OTRO')")->execute();
  return (int)$pdo->lastInsertId();
}

try {
  $op = $_GET['op'] ?? 'list';

  /* -------- CREATE -------- */
  if ($op === 'create') {
    $in = json_input();

    $fecha       = $in['fecha'] ?? date('Y-m-d');
    $categoria   = strtoupper(trim((string)($in['categoria'] ?? 'SIN CATEGORÍA')));
    $descripcion = strtoupper(trim((string)($in['descripcion'] ?? '')));
    $idMedio     = resolver_id_medio_pago($pdo, $in['id_medio_pago'] ?? null, $in['medio_pago'] ?? null);
    $monto       = (int)($in['monto'] ?? 0);
    $comp        = $in['comprobante_url'] ?? null;

    $sql = "INSERT INTO egresos (fecha, categoria, descripcion, id_medio_pago, monto, comprobante_url)
            VALUES (:fecha,:categoria,:descripcion,:idmedio,:monto,:comp)";
    $st = $pdo->prepare($sql);
    $st->execute([
      ':fecha'      => $fecha,
      ':categoria'  => $categoria,
      ':descripcion'=> ($descripcion !== '' ? $descripcion : null),
      ':idmedio'    => $idMedio,
      ':monto'      => $monto,
      ':comp'       => $comp,
    ]);

    echo json_encode(['exito'=>true, 'id_egreso' => (int)$pdo->lastInsertId()], JSON_UNESCAPED_UNICODE);
    exit;
  }

  /* -------- UPDATE -------- */
  if ($op === 'update') {
    $in = json_input();
    $id = (int)($in['id_egreso'] ?? 0);
    if ($id <= 0) throw new InvalidArgumentException('id_egreso inválido');

    $fecha       = $in['fecha'] ?? date('Y-m-d');
    $categoria   = strtoupper(trim((string)($in['categoria'] ?? 'SIN CATEGORÍA')));
    $descripcion = strtoupper(trim((string)($in['descripcion'] ?? '')));
    $idMedio     = resolver_id_medio_pago($pdo, $in['id_medio_pago'] ?? null, $in['medio_pago'] ?? null);
    $monto       = (int)($in['monto'] ?? 0);
    $comp        = $in['comprobante_url'] ?? null;

    $sql = "UPDATE egresos SET
              fecha=:fecha, categoria=:categoria, descripcion=:descripcion,
              id_medio_pago=:idmedio, monto=:monto, comprobante_url=:comp
            WHERE id_egreso=:id";
    $st = $pdo->prepare($sql);
    $st->execute([
      ':id'         => $id,
      ':fecha'      => $fecha,
      ':categoria'  => $categoria,
      ':descripcion'=> ($descripcion !== '' ? $descripcion : null),
      ':idmedio'    => $idMedio,
      ':monto'      => $monto,
      ':comp'       => $comp,
    ]);

    echo json_encode(['exito'=>true], JSON_UNESCAPED_UNICODE);
    exit;
  }

  /* -------- DELETE -------- */
  if ($op === 'delete') {
    $in = json_input();
    $id = (int)($in['id_egreso'] ?? 0);
    if ($id <= 0) throw new InvalidArgumentException('id_egreso inválido');

    $st = $pdo->prepare("DELETE FROM egresos WHERE id_egreso=:id");
    $st->execute([':id'=>$id]);
    echo json_encode(['exito'=>true], JSON_UNESCAPED_UNICODE);
    exit;
  }

  /* -------- RESUMEN -------- */
  if ($op === 'resumen') {
    $year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');

    $_GET_bak = $_GET;
    $_GET = ['action'=>'contable_ingresos','year'=>$year];
    ob_start();
    require __DIR__.'/ingresos.php';
    $ingRaw = ob_get_clean();
    $_GET = $_GET_bak;

    $ing = json_decode($ingRaw, true);
    $ingresosMes = [];
    if (is_array($ing) && !empty($ing['resumen'])) {
      foreach ($ing['resumen'] as $r) {
        $key = sprintf('%04d-%02d', (int)$r['anio'], (int)$r['mes']);
        $ingresosMes[$key] = (int)$r['ingresos'];
      }
    }

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

    $MESES = [1=>'ENERO',2=>'FEBRERO',3=>'MARZO',4=>'ABRIL',5=>'MAYO',6=>'JUNIO',7=>'JULIO',8=>'AGOSTO',9=>'SEPTIEMBRE',10=>'OCTUBRE',11=>'NOVIEMBRE',12=>'DICIEMBRE'];
    $out = [];
    for ($m=1;$m<=12;$m++){
      $key = sprintf('%04d-%02d', $year, $m);
      $ingV = $ingresosMes[$key] ?? 0;
      $egrV = $egresosMes[$key] ?? 0;
      $out[] = [
        'anio' => $year,
        'mes'  => $m,
        'nombre_mes' => $MESES[$m],
        'ingresos' => $ingV,
        'egresos'  => $egrV,
        'saldo'    => $ingV - $egrV
      ];
    }
    echo json_encode(['exito'=>true, 'year'=>$year, 'resumen'=>$out], JSON_UNESCAPED_UNICODE);
    exit;
  }

  /* -------- LIST -------- */
  $start = $_GET['start'] ?? null; // YYYY-MM-DD
  $end   = $_GET['end']   ?? null;
  $cat   = trim((string)($_GET['categoria'] ?? ''));
  $medio = trim((string)($_GET['medio'] ?? '')); // puede ser ID o nombre

  $where = "1=1";
  $par   = [];
  if ($start && $end) {
    $where .= " AND e.fecha BETWEEN :s AND :e";
    $par[':s'] = $start;
    $par[':e'] = $end;
  } elseif ($start) {
    $where .= " AND e.fecha >= :s";
    $par[':s'] = $start;
  } elseif ($end) {
    $where .= " AND e.fecha <= :e";
    $par[':e'] = $end;
  }
  if ($cat !== '') {
    $where .= " AND e.categoria = :c";
    $par[':c'] = $cat;
  }
  if ($medio !== '') {
    if (ctype_digit($medio)) {
      $where .= " AND e.id_medio_pago = :mid";
      $par[':mid'] = (int)$medio;
    } else {
      $where .= " AND UPPER(m.medio_pago) = UPPER(:mnom)";
      $par[':mnom'] = $medio;
    }
  }

  $sql = "SELECT
            e.*,
            m.medio_pago AS medio_pago
          FROM egresos e
          JOIN medio_pago m ON m.id_medio_pago = e.id_medio_pago
          WHERE $where
          ORDER BY e.fecha DESC, e.id_egreso DESC";
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
