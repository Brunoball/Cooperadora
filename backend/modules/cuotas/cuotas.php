<?php
// backend/modules/cuotas/cuotas.php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

const ID_MES_ANUAL = 13;

/**
 * ✅ Regla corregida:
 * - Si activo=1 => SIEMPRE elegible (no se excluye por ingreso)
 * - Si activo=0 => si lo incluimos por pagos, se puede aplicar ingreso como filtro suave
 */
function alumnoElegible(array $a, int $mesPeriodo, int $anioPeriodo): bool {
  // Si está activo => siempre mostrar
  if ((int)($a['activo'] ?? 0) === 1) return true;

  // Si está inactivo, aplicamos ingreso SOLO si existe (filtro suave)
  $ingreso = $a['ingreso'] ?? null;
  if (!$ingreso) return true;

  try {
    $f = new DateTime((string)$ingreso);
  } catch (Throwable $e) {
    return true; // si viene mal, no lo excluimos
  }

  $mesIng  = (int)$f->format('m');
  $anioIng = (int)$f->format('Y');

  return ($anioIng < $anioPeriodo) || ($anioIng === $anioPeriodo && $mesIng <= $mesPeriodo);
}

/* === Endpoint: listar años con pagos (solo años existentes) ===
   GET ...?action=cuotas&listar_anios=1
*/
if (isset($_GET['listar_anios'])) {
  try {
    if (!($pdo instanceof PDO)) throw new RuntimeException('Conexión PDO no disponible.');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $st = $pdo->query("
      SELECT DISTINCT YEAR(fecha_pago) AS anio
      FROM pagos
      WHERE fecha_pago IS NOT NULL
      ORDER BY anio DESC
    ");
    $rows = $st->fetchAll(PDO::FETCH_COLUMN);

    $anios = [];
    foreach ($rows ?: [] as $y) {
      $y = (int)$y;
      if ($y > 0) $anios[] = ['id' => $y, 'nombre' => (string)$y];
    }

    echo json_encode(['exito' => true, 'anios' => $anios], JSON_UNESCAPED_UNICODE);
    exit;
  } catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'No se pudieron obtener los años'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}

try {
  if (!($pdo instanceof PDO)) throw new RuntimeException('Conexión PDO no disponible.');
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  // == Parámetros ==
  $anioFiltro  = isset($_GET['anio']) ? max(1900, (int)$_GET['anio']) : (int)date('Y'); // año de pago
  $idMesFiltro = isset($_GET['id_mes']) ? (int)$_GET['id_mes'] : 0;

  $soloPagados = isset($_GET['pagados']);
  $soloCondon  = isset($_GET['condonados']);

  // == Meses ==
  $stMes = $pdo->query("SELECT id_mes, nombre FROM meses ORDER BY id_mes");
  $mesesRows = $stMes->fetchAll(PDO::FETCH_ASSOC);

  $meses = [];
  foreach ($mesesRows as $m) {
    $meses[(int)$m['id_mes']] = (string)$m['nombre'];
  }
  if (!isset($meses[ID_MES_ANUAL])) $meses[ID_MES_ANUAL] = 'CONTADO ANUAL';

  // ¿Incluimos inactivos? solo si pedís pagados/condonados y filtrás por un mes concreto
  $incluirInactivos = ($idMesFiltro > 0) && ($soloPagados || $soloCondon);

  // == Alumnos ==
  $sqlAlu = "
    SELECT
      a.id_alumno, a.apellido, a.nombre, a.num_documento,
      a.domicilio, a.localidad, a.telefono,
      a.id_año, a.id_division, a.id_categoria, a.activo, a.ingreso
    FROM alumnos a
  ";

  if ($incluirInactivos) {
    $sqlAlu .= "
      WHERE a.activo = 1
         OR EXISTS (
              SELECT 1 FROM pagos p
               WHERE p.id_alumno = a.id_alumno
                 AND p.id_mes IN (:mes_consulta, :mes_anual)
                 AND p.fecha_pago IS NOT NULL
                 AND YEAR(p.fecha_pago) = :anio_pagos
         )
    ";
  } else {
    $sqlAlu .= " WHERE a.activo = 1 ";
  }

  $sqlAlu .= " ORDER BY a.apellido ASC, a.nombre ASC ";

  $stAlu = $pdo->prepare($sqlAlu);

  if ($incluirInactivos) {
    $stAlu->bindValue(':mes_consulta', $idMesFiltro ?: 0, PDO::PARAM_INT);
    $stAlu->bindValue(':mes_anual', ID_MES_ANUAL, PDO::PARAM_INT);
    $stAlu->bindValue(':anio_pagos', $anioFiltro, PDO::PARAM_INT);
  }

  $stAlu->execute();
  $alumnos = $stAlu->fetchAll(PDO::FETCH_ASSOC);

  // == Pagos del año ==
  $paramsPagos = [':anio' => $anioFiltro];

  if ($idMesFiltro > 0 && $idMesFiltro !== ID_MES_ANUAL) {
    $sqlPag = "
      SELECT id_alumno, id_mes, estado
        FROM pagos
       WHERE fecha_pago IS NOT NULL
         AND YEAR(fecha_pago) = :anio
         AND id_mes IN (:mes, :anual)
    ";
    $paramsPagos[':mes']   = $idMesFiltro;
    $paramsPagos[':anual'] = ID_MES_ANUAL;
  } else {
    $sqlPag = "
      SELECT id_alumno, id_mes, estado
        FROM pagos
       WHERE fecha_pago IS NOT NULL
         AND YEAR(fecha_pago) = :anio
    ";
  }

  $stPag = $pdo->prepare($sqlPag);
  foreach ($paramsPagos as $k => $v) {
    $stPag->bindValue($k, $v, is_int($v) ? PDO::PARAM_INT : PDO::PARAM_STR);
  }
  $stPag->execute();
  $pagos = $stPag->fetchAll(PDO::FETCH_ASSOC);

  // Indexación de pagos
  $pagoDirecto = []; // [id_alumno][id_mes] = 'pagado'|'condonado'
  $pagoAnual   = []; // [id_alumno]        = 'pagado'|'condonado'

  foreach ($pagos as $p) {
    $ida = (int)$p['id_alumno'];
    $idm = (int)$p['id_mes'];
    $est = ($p['estado'] === 'condonado') ? 'condonado' : 'pagado';

    if ($idm === ID_MES_ANUAL) $pagoAnual[$ida] = $est;
    else $pagoDirecto[$ida][$idm] = $est;
  }

  // Meses a producir
  $listaMeses = array_keys($meses);
  $listaMeses = array_values(array_filter($listaMeses, fn($m) => (int)$m !== ID_MES_ANUAL)); // 1..12

  if ($idMesFiltro > 0 && $idMesFiltro !== ID_MES_ANUAL) {
    $listaMeses = [$idMesFiltro];
  }

  $mostrarSoloAnual = ($idMesFiltro === ID_MES_ANUAL);

  $cuotas = [];

  foreach ($alumnos as $a) {
    $idAlu = (int)$a['id_alumno'];

    $apellido = trim((string)($a['apellido'] ?? ''));
    $nombre   = trim((string)($a['nombre'] ?? ''));
    $nombreCompleto = trim($apellido . ', ' . $nombre, ', ');

    // ANUAL (si piden id_mes 13)
    if ($mostrarSoloAnual) {
      // ✅ elegible: activo siempre entra, inactivo entra si elegible por ingreso (suave)
      if (!alumnoElegible($a, 12, $anioFiltro)) continue;

      $estado = isset($pagoAnual[$idAlu]) ? $pagoAnual[$idAlu] : 'deudor';
      if ($soloPagados && $estado !== 'pagado') continue;
      if ($soloCondon  && $estado !== 'condonado') continue;

      $cuotas[] = [
        'id_alumno'    => $idAlu,
        'nombre'       => $nombreCompleto,
        'dni'          => (string)($a['num_documento'] ?? ''),
        'domicilio'    => (string)($a['domicilio'] ?? ''),
        'estado'       => ((int)($a['activo'] ?? 0) === 1 ? 'ACTIVO' : 'INACTIVO'),
        'medio_pago'   => '',
        'mes'          => $meses[ID_MES_ANUAL],
        'id_mes'       => ID_MES_ANUAL,
        'id_año'       => (int)($a['id_año'] ?? 0),
        'id_anio'      => (int)($a['id_año'] ?? 0),
        'id_division'  => (int)($a['id_division'] ?? 0),
        'id_categoria' => (int)($a['id_categoria'] ?? 0),
        'estado_pago'  => $estado,
        'origen_anual' => isset($pagoAnual[$idAlu]) ? 1 : 0,
      ];
      continue;
    }

    // Meses 1..12
    foreach ($listaMeses as $idm) {
      $idm = (int)$idm;

      // ✅ CORREGIDO: no excluir activos por ingreso
      if (!alumnoElegible($a, $idm, $anioFiltro)) continue;

      // Estado
      if (isset($pagoDirecto[$idAlu][$idm])) {
        $estado = $pagoDirecto[$idAlu][$idm];
        $fromAnual = 0;
      } elseif (isset($pagoAnual[$idAlu])) {
        $estado = $pagoAnual[$idAlu];
        $fromAnual = 1;
      } else {
        $estado = 'deudor';
        $fromAnual = 0;
      }

      if ($soloPagados && $estado !== 'pagado') continue;
      if ($soloCondon  && $estado !== 'condonado') continue;

      $cuotas[] = [
        'id_alumno'    => $idAlu,
        'nombre'       => $nombreCompleto,
        'dni'          => (string)($a['num_documento'] ?? ''),
        'domicilio'    => (string)($a['domicilio'] ?? ''),
        'estado'       => ((int)($a['activo'] ?? 0) === 1 ? 'ACTIVO' : 'INACTIVO'),
        'medio_pago'   => '',
        'mes'          => $meses[$idm] ?? (string)$idm,
        'id_mes'       => $idm,
        'id_año'       => (int)($a['id_año'] ?? 0),
        'id_anio'      => (int)($a['id_año'] ?? 0),
        'id_division'  => (int)($a['id_division'] ?? 0),
        'id_categoria' => (int)($a['id_categoria'] ?? 0),
        'estado_pago'  => $estado,
        'origen_anual' => $fromAnual,
      ];
    }
  }

  echo json_encode(['exito' => true, 'cuotas' => $cuotas], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(200);
  echo json_encode(['exito' => false, 'mensaje' => 'Error al obtener cuotas: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
