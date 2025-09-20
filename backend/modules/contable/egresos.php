<?php
/**
 * /api.php?action=contable_egresos
 *
 * Métodos por parámetro 'op':
 *  - op=list   [GET]    ?start=YYYY-MM-DD&end=YYYY-MM-DD&categoria=...&medio=...
 *  - op=create [POST]   JSON: {fecha, categoria, numero_factura?, descripcion, id_medio_pago|medio_pago, monto, comprobante_url?}
 *  - op=update [POST]   JSON: {id_egreso, ...}
 *  - op=delete [POST]   JSON: {id_egreso}
 *
 * (⚠️ Compat) Si llaman op=resumen, se delega a contable_resumen.
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

function resolver_id_medio_pago(PDO $pdo, $id, $nombre): int {
  $id = is_numeric($id) ? (int)$id : 0;
  if ($id > 0) return $id;
  $nom = strtoupper(trim((string)$nombre));
  if ($nom === '') throw new InvalidArgumentException('id_medio_pago o medio_pago requerido.');
  $st = $pdo->prepare("SELECT id_medio_pago FROM medio_pago WHERE UPPER(medio_pago)=:n LIMIT 1");
  $st->execute([':n' => $nom]);
  $found = $st->fetchColumn();
  if ($found) return (int)$found;
  $st = $pdo->query("SELECT id_medio_pago FROM medio_pago WHERE UPPER(medio_pago)='OTRO' LIMIT 1");
  $otro = $st->fetchColumn();
  if ($otro) return (int)$otro;
  $pdo->prepare("INSERT INTO medio_pago (medio_pago) VALUES ('OTRO')")->execute();
  return (int)$pdo->lastInsertId();
}

try {
  $op = $_GET['op'] ?? 'list';

  /* Compat: delega si piden resumen */
  if ($op === 'resumen') {
    require __DIR__ . '/resumen.php';
    exit;
  }

  /* -------- CREATE -------- */
  if ($op === 'create') {
    $in = json_input();

    $fecha       = $in['fecha'] ?? date('Y-m-d');
    $categoria   = strtoupper(trim((string)($in['categoria'] ?? 'SIN CATEGORÍA')));
    $numFac      = trim((string)($in['numero_factura'] ?? ''));
    if ($numFac === '') $numFac = null;                 // nullable
    if ($numFac !== null && mb_strlen($numFac) > 50) {
      throw new InvalidArgumentException('El número de factura no puede superar 50 caracteres.');
    }
    $descripcion = strtoupper(trim((string)($in['descripcion'] ?? '')));
    $idMedio     = resolver_id_medio_pago($pdo, $in['id_medio_pago'] ?? null, $in['medio_pago'] ?? null);
    $monto       = (int)($in['monto'] ?? 0);
    $comp        = $in['comprobante_url'] ?? null;

    $sql = "INSERT INTO egresos (fecha, categoria, numero_factura, descripcion, id_medio_pago, monto, comprobante_url)
            VALUES (:fecha,:categoria,:numfac,:descripcion,:idmedio,:monto,:comp)";
    $st = $pdo->prepare($sql);
    $st->execute([
      ':fecha'       => $fecha,
      ':categoria'   => $categoria,
      ':numfac'      => $numFac,
      ':descripcion' => ($descripcion !== '' ? $descripcion : null),
      ':idmedio'     => $idMedio,
      ':monto'       => $monto,
      ':comp'        => $comp,
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
    $numFac      = trim((string)($in['numero_factura'] ?? ''));
    if ($numFac === '') $numFac = null;
    if ($numFac !== null && mb_strlen($numFac) > 50) {
      throw new InvalidArgumentException('El número de factura no puede superar 50 caracteres.');
    }
    $descripcion = strtoupper(trim((string)($in['descripcion'] ?? '')));
    $idMedio     = resolver_id_medio_pago($pdo, $in['id_medio_pago'] ?? null, $in['medio_pago'] ?? null);
    $monto       = (int)($in['monto'] ?? 0);
    $comp        = $in['comprobante_url'] ?? null;

    $sql = "UPDATE egresos SET
              fecha=:fecha,
              categoria=:categoria,
              numero_factura=:numfac,
              descripcion=:descripcion,
              id_medio_pago=:idmedio,
              monto=:monto,
              comprobante_url=:comp
            WHERE id_egreso=:id";
    $st = $pdo->prepare($sql);
    $st->execute([
      ':id'          => $id,
      ':fecha'       => $fecha,
      ':categoria'   => $categoria,
      ':numfac'      => $numFac,
      ':descripcion' => ($descripcion !== '' ? $descripcion : null),
      ':idmedio'     => $idMedio,
      ':monto'       => $monto,
      ':comp'        => $comp,
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

  /* -------- LIST -------- */
  $start = $_GET['start'] ?? null; // YYYY-MM-DD
  $end   = $_GET['end']   ?? null;
  $cat   = trim((string)($_GET['categoria'] ?? ''));
  $medio = trim((string)($_GET['medio'] ?? ''));

  $where = "1=1";
  $par   = [];
  if ($start && $end) {
    $where .= " AND e.fecha BETWEEN :s AND :e";
    $par[':s'] = $start; $par[':e'] = $end;
  } elseif ($start) {
    $where .= " AND e.fecha >= :s";  $par[':s'] = $start;
  } elseif ($end) {
    $where .= " AND e.fecha <= :e";  $par[':e'] = $end;
  }
  if ($cat !== '') {
    $where .= " AND e.categoria = :c"; $par[':c'] = $cat;
  }
  if ($medio !== '') {
    if (ctype_digit($medio)) {
      $where .= " AND e.id_medio_pago = :mid"; $par[':mid'] = (int)$medio;
    } else {
      $where .= " AND UPPER(m.medio_pago) = UPPER(:mnom)"; $par[':mnom'] = $medio;
    }
  }

  $sql = "SELECT e.*, m.medio_pago AS medio_pago
          FROM egresos e
          JOIN medio_pago m ON m.id_medio_pago = e.id_medio_pago
          WHERE $where
          ORDER BY e.fecha DESC, e.id_egreso DESC";
  $st = $pdo->prepare($sql);
  $st->execute($par);
  $list = $st->fetchAll(PDO::FETCH_ASSOC);

  $total = 0.0;
  foreach ($list as $r) $total += (float)$r['monto'];

  echo json_encode(['exito'=>true, 'total'=>$total, 'datos'=>$list], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['exito'=>false, 'mensaje'=>'Error: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
}
