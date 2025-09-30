<?php
/**
 * backend/modules/contable/egresos.php
 * /api.php?action=contable_egresos
 *
 * op=list, op=list_years, op=create, op=update, op=delete
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

if (!isset($pdo)) { require_once __DIR__ . '/../../config/db.php'; }
if (!($pdo instanceof PDO)) {
  http_response_code(500);
  echo json_encode(['exito'=>false,'mensaje'=>'Conexión PDO no disponible.']);
  exit;
}
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec("SET NAMES utf8mb4");

/* ---------- Helpers ---------- */
function json_input(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') return [];
  $obj = json_decode($raw, true);
  return is_array($obj) ? $obj : [];
}
function resolver_id_medio_pago(PDO $pdo, $id, $nombre): int {
  $id = is_numeric($id) ? (int)$id : 0;
  if ($id > 0) return $id;
  $nom = strtoupper(trim((string)$nombre));
  if ($nom === '') throw new InvalidArgumentException('id_medio_pago o medio_pago requerido.');
  $st = $pdo->prepare("SELECT id_medio_pago FROM medio_pago WHERE UPPER(medio_pago)=:n LIMIT 1");
  $st->execute([':n'=>$nom]);
  $found = $st->fetchColumn();
  if ($found) return (int)$found;
  // fallback OTRO
  $otro = $pdo->query("SELECT id_medio_pago FROM medio_pago WHERE UPPER(medio_pago)='OTRO' LIMIT 1")->fetchColumn();
  if ($otro) return (int)$otro;
  $pdo->prepare("INSERT INTO medio_pago (medio_pago) VALUES ('OTRO')")->execute();
  return (int)$pdo->lastInsertId();
}
function buscar_id_por_nombre(PDO $pdo, string $tabla, string $colId, string $colNombre, ?string $nombre): ?int {
  $nombre = strtoupper(trim((string)$nombre));
  if ($nombre === '') return null;
  $sql = "SELECT {$colId} FROM {$tabla} WHERE UPPER({$colNombre}) = :n LIMIT 1";
  $st = $pdo->prepare($sql);
  $st->execute([':n'=>$nombre]);
  $id = $st->fetchColumn();
  return $id ? (int)$id : null;
}
function obtener_anios_disponibles(PDO $pdo): array {
  $st = $pdo->query("SELECT DISTINCT YEAR(fecha) AS anio FROM egresos ORDER BY anio DESC");
  return array_map(static fn($r)=>(int)$r['anio'], $st->fetchAll(PDO::FETCH_ASSOC));
}
function obtener_max_fecha(PDO $pdo): ?string {
  $r = $pdo->query("SELECT DATE_FORMAT(MAX(fecha),'%Y-%m-%d') AS f FROM egresos")->fetch(PDO::FETCH_ASSOC);
  return $r && $r['f'] ? $r['f'] : null;
}

/* ---------- Router ---------- */
try {
  $op = $_GET['op'] ?? 'list';

  if ($op === 'list_years') {
    echo json_encode([
      'exito' => true,
      'anios_disponibles' => obtener_anios_disponibles($pdo),
      'max_fecha' => obtener_max_fecha($pdo),
    ], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if ($op === 'list') {
    $start = $_GET['start'] ?? null; // YYYY-MM-DD
    $end   = $_GET['end']   ?? null;
    $wantMeta = isset($_GET['meta']) && (int)$_GET['meta'] === 1;

    $catId   = isset($_GET['categoria_id'])   ? (int)$_GET['categoria_id']   : 0;
    $provId  = isset($_GET['proveedor_id'])   ? (int)$_GET['proveedor_id']   : 0;
    $descId  = isset($_GET['descripcion_id']) ? (int)$_GET['descripcion_id'] : 0;
    $medio   = trim((string)($_GET['medio'] ?? ''));

    if ($catId === 0 && isset($_GET['categoria'])) {
      $catId = buscar_id_por_nombre($pdo, 'contable_categoria','id_cont_categoria','nombre_categoria', $_GET['categoria']) ?? 0;
    }
    if ($provId === 0 && isset($_GET['proveedor'])) {
      $provId = buscar_id_por_nombre($pdo, 'contable_proveedor','id_cont_proveedor','nombre_proveedor', $_GET['proveedor']) ?? 0;
    }
    if ($descId === 0 && isset($_GET['descripcion'])) {
      $descId = buscar_id_por_nombre($pdo, 'contable_descripcion','id_cont_descripcion','nombre_descripcion', $_GET['descripcion']) ?? 0;
    }

    $where = "1=1";
    $par   = [];
    if ($start && $end) { $where .= " AND e.fecha BETWEEN :s AND :e"; $par[':s']=$start; $par[':e']=$end; }
    elseif ($start) { $where .= " AND e.fecha >= :s"; $par[':s']=$start; }
    elseif ($end) { $where .= " AND e.fecha <= :e"; $par[':e']=$end; }

    if ($catId > 0) { $where .= " AND e.id_cont_categoria = :cid"; $par[':cid']=$catId; }
    if ($provId> 0) { $where .= " AND e.id_cont_proveedor = :pid"; $par[':pid']=$provId; }
    if ($descId> 0) { $where .= " AND e.id_cont_descripcion = :did"; $par[':did']=$descId; }

    if ($medio !== '') {
      if (ctype_digit($medio)) { $where .= " AND e.id_medio_pago = :mid"; $par[':mid'] = (int)$medio; }
      else { $where .= " AND UPPER(mp.medio_pago) = UPPER(:mnom)"; $par[':mnom'] = $medio; }
    }

    $sql = "
      SELECT
        e.id_egreso,
        DATE_FORMAT(e.fecha,'%Y-%m-%d') AS fecha,
        e.id_cont_categoria,
        cc.nombre_categoria,
        e.id_cont_proveedor,
        cp.nombre_proveedor,
        e.comprobante,
        e.id_cont_descripcion,
        cd.nombre_descripcion,
        e.id_medio_pago,
        mp.medio_pago,
        e.importe,
        e.comprobante_url
      FROM egresos e
      LEFT JOIN contable_categoria   cc ON cc.id_cont_categoria   = e.id_cont_categoria
      LEFT JOIN contable_proveedor   cp ON cp.id_cont_proveedor   = e.id_cont_proveedor
      LEFT JOIN contable_descripcion cd ON cd.id_cont_descripcion = e.id_cont_descripcion
      INNER JOIN medio_pago          mp ON mp.id_medio_pago       = e.id_medio_pago
      WHERE $where
      ORDER BY e.fecha DESC, e.id_egreso DESC
    ";
    $st = $pdo->prepare($sql);
    $st->execute($par);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    $total = 0; foreach ($rows as $r) $total += (int)$r['importe'];

    $out = ['exito'=>true,'total'=>$total,'datos'=>$rows];
    if ($wantMeta) $out['anios_disponibles'] = obtener_anios_disponibles($pdo);
    echo json_encode($out, JSON_UNESCAPED_UNICODE);
    exit;
  }

  if ($op === 'create') {
    $in = json_input();

    $fecha  = trim((string)($in['fecha'] ?? ''));
    if (!$fecha || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
      throw new InvalidArgumentException('fecha requerida (YYYY-MM-DD).');
    }

    $idCat  = isset($in['id_cont_categoria'])   && $in['id_cont_categoria']   !== '' ? (int)$in['id_cont_categoria']   : null;
    $idProv = isset($in['id_cont_proveedor'])   && $in['id_cont_proveedor']   !== '' ? (int)$in['id_cont_proveedor']   : null;
    $idDesc = isset($in['id_cont_descripcion']) && $in['id_cont_descripcion'] !== '' ? (int)$in['id_cont_descripcion'] : null;

    $idMedio = resolver_id_medio_pago($pdo, $in['id_medio_pago'] ?? null, $in['medio_pago'] ?? null);

    $importe = $in['importe'] ?? null;
    if (!is_numeric($importe) || (int)$importe <= 0) {
      throw new InvalidArgumentException('importe inválido.');
    }

    $comprobante = trim((string)($in['comprobante'] ?? '')) ?: null;
    if ($comprobante !== null && mb_strlen($comprobante) > 100) {
      throw new InvalidArgumentException('comprobante no puede superar 100 caracteres.');
    }

    $compURL = trim((string)($in['comprobante_url'] ?? '')) ?: null;
    if ($compURL !== null && mb_strlen($compURL) > 512) {
      throw new InvalidArgumentException('comprobante_url demasiado largo.');
    }

    // validar FKs si vinieron
    if ($idCat !== null) {
      $ok = $pdo->prepare("SELECT 1 FROM contable_categoria WHERE id_cont_categoria=:id");
      $ok->execute([':id'=>$idCat]);
      if (!$ok->fetchColumn()) throw new InvalidArgumentException('id_cont_categoria inexistente.');
    }
    if ($idProv !== null) {
      $ok = $pdo->prepare("SELECT 1 FROM contable_proveedor WHERE id_cont_proveedor=:id");
      $ok->execute([':id'=>$idProv]);
      if (!$ok->fetchColumn()) throw new InvalidArgumentException('id_cont_proveedor inexistente.');
    }
    if ($idDesc !== null) {
      $ok = $pdo->prepare("SELECT 1 FROM contable_descripcion WHERE id_cont_descripcion=:id");
      $ok->execute([':id'=>$idDesc]);
      if (!$ok->fetchColumn()) throw new InvalidArgumentException('id_cont_descripcion inexistente.');
    }

    $sql = "INSERT INTO egresos
              (fecha, id_cont_categoria, id_cont_proveedor, comprobante, id_cont_descripcion, id_medio_pago, importe, comprobante_url)
            VALUES
              (:f, :c, :p, :comp, :d, :m, :i, :url)";
    $st = $pdo->prepare($sql);
    $st->execute([
      ':f'    => $fecha,
      ':c'    => $idCat,
      ':p'    => $idProv,
      ':comp' => $comprobante,
      ':d'    => $idDesc,
      ':m'    => $idMedio,
      ':i'    => (int)$importe,
      ':url'  => $compURL,
    ]);

    echo json_encode(['exito'=>true,'id_egreso'=>(int)$pdo->lastInsertId(), 'fecha'=>$fecha], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if ($op === 'update') {
    $in = json_input();
    $id = (int)($in['id_egreso'] ?? 0);
    if ($id <= 0) throw new InvalidArgumentException('id_egreso inválido.');

    $fecha  = trim((string)($in['fecha'] ?? ''));
    if (!$fecha || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
      throw new InvalidArgumentException('fecha requerida (YYYY-MM-DD).');
    }

    $idCat  = isset($in['id_cont_categoria'])   && $in['id_cont_categoria']   !== '' ? (int)$in['id_cont_categoria']   : null;
    $idProv = isset($in['id_cont_proveedor'])   && $in['id_cont_proveedor']   !== '' ? (int)$in['id_cont_proveedor']   : null;
    $idDesc = isset($in['id_cont_descripcion']) && $in['id_cont_descripcion'] !== '' ? (int)$in['id_cont_descripcion'] : null;

    $idMedio = resolver_id_medio_pago($pdo, $in['id_medio_pago'] ?? null, $in['medio_pago'] ?? null);

    $importe = $in['importe'] ?? null;
    if (!is_numeric($importe) || (int)$importe <= 0) {
      throw new InvalidArgumentException('importe inválido.');
    }

    $comprobante = trim((string)($in['comprobante'] ?? '')) ?: null;
    if ($comprobante !== null && mb_strlen($comprobante) > 100) {
      throw new InvalidArgumentException('comprobante no puede superar 100 caracteres.');
    }

    $compURL = trim((string)($in['comprobante_url'] ?? '')) ?: null;
    if ($compURL !== null && mb_strlen($compURL) > 512) {
      throw new InvalidArgumentException('comprobante_url demasiado largo.');
    }

    if ($idCat !== null) {
      $ok = $pdo->prepare("SELECT 1 FROM contable_categoria WHERE id_cont_categoria=:id");
      $ok->execute([':id'=>$idCat]);
      if (!$ok->fetchColumn()) throw new InvalidArgumentException('id_cont_categoria inexistente.');
    }
    if ($idProv !== null) {
      $ok = $pdo->prepare("SELECT 1 FROM contable_proveedor WHERE id_cont_proveedor=:id");
      $ok->execute([':id'=>$idProv]);
      if (!$ok->fetchColumn()) throw new InvalidArgumentException('id_cont_proveedor inexistente.');
    }
    if ($idDesc !== null) {
      $ok = $pdo->prepare("SELECT 1 FROM contable_descripcion WHERE id_cont_descripcion=:id");
      $ok->execute([':id'=>$idDesc]);
      if (!$ok->fetchColumn()) throw new InvalidArgumentException('id_cont_descripcion inexistente.');
    }

    $sql = "UPDATE egresos SET
              fecha=:f,
              id_cont_categoria=:c,
              id_cont_proveedor=:p,
              comprobante=:comp,
              id_cont_descripcion=:d,
              id_medio_pago=:m,
              importe=:i,
              comprobante_url=:url
            WHERE id_egreso=:id";
    $st = $pdo->prepare($sql);
    $st->execute([
      ':id'   => $id,
      ':f'    => $fecha,
      ':c'    => $idCat,
      ':p'    => $idProv,
      ':comp' => $comprobante,
      ':d'    => $idDesc,
      ':m'    => $idMedio,
      ':i'    => (int)$importe,
      ':url'  => $compURL,
    ]);

    echo json_encode(['exito'=>true,'fecha'=>$fecha], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if ($op === 'delete') {
    $in = json_input();
    $id = (int)($in['id_egreso'] ?? 0);
    if ($id <= 0) throw new InvalidArgumentException('id_egreso inválido.');
    $st = $pdo->prepare("DELETE FROM egresos WHERE id_egreso=:id");
    $st->execute([':id'=>$id]);
    echo json_encode(['exito'=>true], JSON_UNESCAPED_UNICODE);
    exit;
  }

  http_response_code(400);
  echo json_encode(['exito'=>false,'mensaje'=>'Operación no válida.'], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(400);
  echo json_encode(['exito'=>false,'mensaje'=>'Error: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
}
