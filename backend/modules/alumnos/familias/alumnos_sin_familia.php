<?php
require_once __DIR__ . '/_common.php';

$pdo = fam_pdo();

$all    = isset($_GET['all']) ? (int)$_GET['all'] : 0;
$q      = fam_str($_GET['q'] ?? '');
$limit  = (int)($_GET['limit'] ?? 200);
$offset = (int)($_GET['offset'] ?? 0);

if ($limit <= 0)   $limit = 200;
if ($limit > 5000) $limit = 5000; // tope alto por si querés usarlo sin all=1
if ($offset < 0)   $offset = 0;

/* Campos mínimos necesarios para el modal (ligero) */
$baseSelect = "
    SELECT 
        a.id_alumno,
        a.apellido,
        a.nombre,
        a.num_documento AS dni,
        a.domicilio,
        a.localidad,
        a.activo,
        CONCAT(a.apellido, ', ', IFNULL(a.nombre, '')) AS nombre_completo
    FROM alumnos a
    WHERE a.id_familia IS NULL
      AND a.activo = 1
";

/* ====== MODO ALL: traer TODO (sin limit/offset), ordenado ====== */
if ($all === 1) {
    $sql = $baseSelect . " ORDER BY a.apellido ASC, a.nombre ASC";
    $st  = $pdo->prepare($sql);
    $st->execute();
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    fam_json([
        'exito'     => true,
        'alumnos'   => $rows,
        'total'     => count($rows),
        'has_more'  => false,
    ]);
    // exit acá evita seguir con el modo paginado
}

/* ====== MODO PAGINADO + BÚSQUEDA (compat/otros usos) ====== */
$params = [];
$sql = $baseSelect;

if ($q !== '') {
    // prefijo para favorecer índices en LIKE (siempre que existan)
    $sql .= " AND (a.apellido LIKE :q OR a.nombre LIKE :q OR a.num_documento LIKE :qdoc)";
    $params[':q']    = $q . '%';
    $params[':qdoc'] = $q . '%';
}

$sqlCount = "SELECT COUNT(*) FROM (" . $sql . ") AS t";
$stCount = $pdo->prepare($sqlCount);
$stCount->execute($params);
$total = (int)$stCount->fetchColumn();

$sql .= " ORDER BY a.apellido ASC, a.nombre ASC
          LIMIT :lim OFFSET :off";

$st = $pdo->prepare($sql);
foreach ($params as $k => $v) $st->bindValue($k, $v);
$st->bindValue(':lim', $limit, PDO::PARAM_INT);
$st->bindValue(':off', $offset, PDO::PARAM_INT);

$st->execute();
$rows = $st->fetchAll(PDO::FETCH_ASSOC);

$hasMore = ($offset + $limit) < $total;

fam_json([
    'exito'     => true,
    'alumnos'   => $rows,
    'total'     => $total,
    'has_more'  => $hasMore,
]);
