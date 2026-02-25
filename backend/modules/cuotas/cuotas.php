<?php
// backend/modules/cuotas/cuotas.php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

const ID_MES_ANUAL        = 13; // CONTADO ANUAL
const ID_MES_MATRICULA    = 14; // MATRÍCULA
const ID_MES_1ER_MITAD    = 15; // 1ER MITAD
const ID_MES_2DA_MITAD    = 16; // 2DA MITAD

// Rangos de meses cubiertos por mitades
const MITAD1_DESDE = 3;  // MARZO
const MITAD1_HASTA = 7;  // JULIO
const MITAD2_DESDE = 8;  // AGOSTO
const MITAD2_HASTA = 12; // DICIEMBRE

/**
 * ✅ Regla corregida:
 * - Si activo=1 => SIEMPRE elegible (no se excluye por ingreso)
 * - Si activo=0 => si lo incluimos por pagos, se puede aplicar ingreso como filtro suave
 */
function alumnoElegible(array $a, int $mesPeriodo, int $anioPeriodo): bool {
  if ((int)($a['activo'] ?? 0) === 1) return true;

  $ingreso = $a['ingreso'] ?? null;
  if (!$ingreso) return true;

  try {
    $f = new DateTime((string)$ingreso);
  } catch (Throwable $e) {
    return true;
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

  // ✅ NUEVO: filtro "solo cobrador"
  // el frontend manda: solo_cobrador=1
  $soloCobrador = (isset($_GET['solo_cobrador']) && (int)$_GET['solo_cobrador'] === 1);

  // == Meses ==
  $stMes = $pdo->query("SELECT id_mes, nombre FROM meses ORDER BY id_mes");
  $mesesRows = $stMes->fetchAll(PDO::FETCH_ASSOC);

  $meses = [];
  foreach ($mesesRows as $m) {
    $meses[(int)$m['id_mes']] = (string)$m['nombre'];
  }

  // fallback por si faltan en tabla (seguridad)
  if (!isset($meses[ID_MES_ANUAL]))      $meses[ID_MES_ANUAL]      = 'CONTADO ANUAL';
  if (!isset($meses[ID_MES_MATRICULA]))  $meses[ID_MES_MATRICULA]  = 'MATRICULA';
  if (!isset($meses[ID_MES_1ER_MITAD]))  $meses[ID_MES_1ER_MITAD]  = '1ER MITAD';
  if (!isset($meses[ID_MES_2DA_MITAD]))  $meses[ID_MES_2DA_MITAD]  = '2DA MITAD';

  // ✅ Mitad asociada al mes consultado
  $mesMitadConsulta = 0;
  if ($idMesFiltro >= MITAD1_DESDE && $idMesFiltro <= MITAD1_HASTA) $mesMitadConsulta = ID_MES_1ER_MITAD;
  if ($idMesFiltro >= MITAD2_DESDE && $idMesFiltro <= MITAD2_HASTA) $mesMitadConsulta = ID_MES_2DA_MITAD;
  if ($idMesFiltro === ID_MES_1ER_MITAD) $mesMitadConsulta = ID_MES_1ER_MITAD;
  if ($idMesFiltro === ID_MES_2DA_MITAD) $mesMitadConsulta = ID_MES_2DA_MITAD;

  // ✅ ¿Incluimos inactivos?
  $incluirInactivos = ($idMesFiltro > 0) && ($soloPagados || $soloCondon);

  // == Alumnos ==
  $sqlAlu = "
    SELECT
      a.id_alumno, a.apellido, a.nombre, a.num_documento,
      a.domicilio, a.localidad, a.telefono,
      a.id_año, a.id_division, a.id_categoria, a.activo, a.ingreso,
      a.es_cobrador
    FROM alumnos a
  ";

  // WHERE dinámico con AND (sin romper tu lógica)
  $where = [];
  $bind  = [];

  // ✅ Si solo cobrador: filtrar es_cobrador=1
  if ($soloCobrador) {
    $where[] = "a.es_cobrador = 1";
  }

  if ($incluirInactivos) {
    // ✅ Ojo: este bloque mantiene EXACTAMENTE tu regla:
    // activos siempre + inactivos SOLO si tienen pagos del año en meses relevantes
    $where[] = "
      (
        a.activo = 1
        OR EXISTS (
          SELECT 1
            FROM pagos p
           WHERE p.id_alumno = a.id_alumno
             AND p.id_mes IN (:mes_consulta, :mes_anual, :mes_mitad, :mes_matricula)
             AND p.fecha_pago IS NOT NULL
             AND YEAR(p.fecha_pago) = :anio_pagos
        )
      )
    ";
    $bind[':mes_consulta']  = (int)($idMesFiltro ?: 0);
    $bind[':mes_anual']     = (int)ID_MES_ANUAL;
    $bind[':mes_mitad']     = (int)($mesMitadConsulta ?: 0);
    $bind[':mes_matricula'] = (int)ID_MES_MATRICULA;
    $bind[':anio_pagos']    = (int)$anioFiltro;
  } else {
    $where[] = "a.activo = 1";
  }

  if (!empty($where)) {
    $sqlAlu .= " WHERE " . implode(" AND ", $where) . " ";
  }

  $sqlAlu .= " ORDER BY a.apellido ASC, a.nombre ASC ";

  $stAlu = $pdo->prepare($sqlAlu);

  foreach ($bind as $k => $v) {
    $stAlu->bindValue($k, $v, PDO::PARAM_INT);
  }

  $stAlu->execute();
  $alumnos = $stAlu->fetchAll(PDO::FETCH_ASSOC);

  // == Pagos del año ==
  $paramsPagos = [':anio' => (int)$anioFiltro];

  $mostrarSoloAnual      = ($idMesFiltro === ID_MES_ANUAL);
  $mostrarSoloMatricula  = ($idMesFiltro === ID_MES_MATRICULA);
  $mostrarSoloMitad1     = ($idMesFiltro === ID_MES_1ER_MITAD);
  $mostrarSoloMitad2     = ($idMesFiltro === ID_MES_2DA_MITAD);

  if ($mostrarSoloMatricula) {
    $sqlPag = "
      SELECT id_alumno, id_mes, estado
        FROM pagos
       WHERE fecha_pago IS NOT NULL
         AND YEAR(fecha_pago) = :anio
         AND id_mes = :matricula
    ";
    $paramsPagos[':matricula'] = (int)ID_MES_MATRICULA;
  } else {
    $debeFiltrarPorMes = ($idMesFiltro > 0 && $idMesFiltro !== ID_MES_ANUAL);

    if ($debeFiltrarPorMes) {
      $sqlPag = "
        SELECT id_alumno, id_mes, estado
          FROM pagos
         WHERE fecha_pago IS NOT NULL
           AND YEAR(fecha_pago) = :anio
           AND id_mes IN (:mes, :anual, :mitad)
      ";
      $paramsPagos[':mes']   = (int)$idMesFiltro;
      $paramsPagos[':anual'] = (int)ID_MES_ANUAL;
      $paramsPagos[':mitad'] = (int)($mesMitadConsulta ?: 0);
    } else {
      $sqlPag = "
        SELECT id_alumno, id_mes, estado
          FROM pagos
         WHERE fecha_pago IS NOT NULL
           AND YEAR(fecha_pago) = :anio
      ";
    }
  }

  $stPag = $pdo->prepare($sqlPag);
  foreach ($paramsPagos as $k => $v) {
    $stPag->bindValue($k, $v, PDO::PARAM_INT);
  }
  $stPag->execute();
  $pagos = $stPag->fetchAll(PDO::FETCH_ASSOC);

  // Indexación de pagos
  $pagoDirecto   = [];
  $pagoAnual     = [];
  $pagoMatricula = [];
  $pagoMitad1    = [];
  $pagoMitad2    = [];

  foreach ($pagos as $p) {
    $ida = (int)$p['id_alumno'];
    $idm = (int)$p['id_mes'];
    $est = ($p['estado'] === 'condonado') ? 'condonado' : 'pagado';

    if ($idm === ID_MES_ANUAL)       { $pagoAnual[$ida] = $est; continue; }
    if ($idm === ID_MES_MATRICULA)   { $pagoMatricula[$ida] = $est; continue; }
    if ($idm === ID_MES_1ER_MITAD)   { $pagoMitad1[$ida] = $est; continue; }
    if ($idm === ID_MES_2DA_MITAD)   { $pagoMitad2[$ida] = $est; continue; }

    $pagoDirecto[$ida][$idm] = $est;
  }

  $cuotas = [];

  foreach ($alumnos as $a) {
    $idAlu = (int)$a['id_alumno'];

    $apellido = trim((string)($a['apellido'] ?? ''));
    $nombre   = trim((string)($a['nombre'] ?? ''));
    $nombreCompleto = trim($apellido . ', ' . $nombre, ', ');

    // ==========================
    // ✅ MATRÍCULA (id_mes = 14)
    // ==========================
    if ($mostrarSoloMatricula) {
      if (!alumnoElegible($a, 1, $anioFiltro)) continue;

      $estado = isset($pagoMatricula[$idAlu]) ? $pagoMatricula[$idAlu] : 'deudor';
      if ($soloPagados && $estado !== 'pagado') continue;
      if ($soloCondon  && $estado !== 'condonado') continue;

      $cuotas[] = [
        'id_alumno'    => $idAlu,
        'nombre'       => $nombreCompleto,
        'dni'          => (string)($a['num_documento'] ?? ''),
        'domicilio'    => (string)($a['domicilio'] ?? ''),
        'estado'       => ((int)($a['activo'] ?? 0) === 1 ? 'ACTIVO' : 'INACTIVO'),
        'medio_pago'   => '',
        'mes'          => $meses[ID_MES_MATRICULA],
        'id_mes'       => ID_MES_MATRICULA,
        'id_año'       => (int)($a['id_año'] ?? 0),
        'id_anio'      => (int)($a['id_año'] ?? 0),
        'id_division'  => (int)($a['id_division'] ?? 0),
        'id_categoria' => (int)($a['id_categoria'] ?? 0),
        'estado_pago'  => $estado,
        'origen_anual' => 0,
        'es_cobrador'  => (int)($a['es_cobrador'] ?? 0),
      ];
      continue;
    }

    // ==========================
    // ✅ ANUAL (id_mes = 13)
    // ==========================
    if ($mostrarSoloAnual) {
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
        'es_cobrador'  => (int)($a['es_cobrador'] ?? 0),
      ];
      continue;
    }

    // ==========================
    // ✅ 1ER MITAD (id_mes = 15)
    // ==========================
    if ($mostrarSoloMitad1) {
      if (!alumnoElegible($a, MITAD1_HASTA, $anioFiltro)) continue;

      $estado = isset($pagoMitad1[$idAlu]) ? $pagoMitad1[$idAlu] : 'deudor';
      if ($soloPagados && $estado !== 'pagado') continue;
      if ($soloCondon  && $estado !== 'condonado') continue;

      $cuotas[] = [
        'id_alumno'    => $idAlu,
        'nombre'       => $nombreCompleto,
        'dni'          => (string)($a['num_documento'] ?? ''),
        'domicilio'    => (string)($a['domicilio'] ?? ''),
        'estado'       => ((int)($a['activo'] ?? 0) === 1 ? 'ACTIVO' : 'INACTIVO'),
        'medio_pago'   => '',
        'mes'          => $meses[ID_MES_1ER_MITAD],
        'id_mes'       => ID_MES_1ER_MITAD,
        'id_año'       => (int)($a['id_año'] ?? 0),
        'id_anio'      => (int)($a['id_año'] ?? 0),
        'id_division'  => (int)($a['id_division'] ?? 0),
        'id_categoria' => (int)($a['id_categoria'] ?? 0),
        'estado_pago'  => $estado,
        'origen_anual' => 0,
        'es_cobrador'  => (int)($a['es_cobrador'] ?? 0),
      ];
      continue;
    }

    // ==========================
    // ✅ 2DA MITAD (id_mes = 16)
    // ==========================
    if ($mostrarSoloMitad2) {
      if (!alumnoElegible($a, MITAD2_HASTA, $anioFiltro)) continue;

      $estado = isset($pagoMitad2[$idAlu]) ? $pagoMitad2[$idAlu] : 'deudor';
      if ($soloPagados && $estado !== 'pagado') continue;
      if ($soloCondon  && $estado !== 'condonado') continue;

      $cuotas[] = [
        'id_alumno'    => $idAlu,
        'nombre'       => $nombreCompleto,
        'dni'          => (string)($a['num_documento'] ?? ''),
        'domicilio'    => (string)($a['domicilio'] ?? ''),
        'estado'       => ((int)($a['activo'] ?? 0) === 1 ? 'ACTIVO' : 'INACTIVO'),
        'medio_pago'   => '',
        'mes'          => $meses[ID_MES_2DA_MITAD],
        'id_mes'       => ID_MES_2DA_MITAD,
        'id_año'       => (int)($a['id_año'] ?? 0),
        'id_anio'      => (int)($a['id_año'] ?? 0),
        'id_division'  => (int)($a['id_division'] ?? 0),
        'id_categoria' => (int)($a['id_categoria'] ?? 0),
        'estado_pago'  => $estado,
        'origen_anual' => 0,
        'es_cobrador'  => (int)($a['es_cobrador'] ?? 0),
      ];
      continue;
    }

    // ==========================
    // ✅ Meses 1..12 (normal)
    // ==========================
    $listaMeses = range(1, 12);
    if ($idMesFiltro > 0 && $idMesFiltro !== ID_MES_ANUAL) {
      $listaMeses = [$idMesFiltro];
    }

    foreach ($listaMeses as $idm) {
      $idm = (int)$idm;
      if ($idm < 1 || $idm > 12) continue;

      if (!alumnoElegible($a, $idm, $anioFiltro)) continue;

      if (isset($pagoDirecto[$idAlu][$idm])) {
        $estado = $pagoDirecto[$idAlu][$idm];
        $fromAnual = 0;
      } elseif (isset($pagoAnual[$idAlu])) {
        $estado = $pagoAnual[$idAlu];
        $fromAnual = 1;
      } elseif ($idm >= MITAD1_DESDE && $idm <= MITAD1_HASTA && isset($pagoMitad1[$idAlu])) {
        $estado = $pagoMitad1[$idAlu];
        $fromAnual = 0;
      } elseif ($idm >= MITAD2_DESDE && $idm <= MITAD2_HASTA && isset($pagoMitad2[$idAlu])) {
        $estado = $pagoMitad2[$idAlu];
        $fromAnual = 0;
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
        'es_cobrador'  => (int)($a['es_cobrador'] ?? 0),
      ];
    }
  }

  echo json_encode([
    'exito' => true,
    'cuotas' => $cuotas,
    'solo_cobrador' => $soloCobrador ? 1 : 0
  ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(200);
  echo json_encode(['exito' => false, 'mensaje' => 'Error al obtener cuotas: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}