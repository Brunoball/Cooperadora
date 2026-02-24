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

  // fallback por si faltan en tabla (seguridad)
  if (!isset($meses[ID_MES_ANUAL]))     $meses[ID_MES_ANUAL]     = 'CONTADO ANUAL';
  if (!isset($meses[ID_MES_MATRICULA])) $meses[ID_MES_MATRICULA] = 'MATRICULA';
  if (!isset($meses[ID_MES_1ER_MITAD])) $meses[ID_MES_1ER_MITAD] = '1ER MITAD';
  if (!isset($meses[ID_MES_2DA_MITAD])) $meses[ID_MES_2DA_MITAD] = '2DA MITAD';

  // ✅ Si el mes filtrado es un mes 3..7 => considerar 1ER MITAD como "cobertura"
  // ✅ Si es un mes 8..12 => considerar 2DA MITAD como "cobertura"
  // ✅ Si el filtro es 15/16 => ese mismo es el "mes consulta"
  $mesMitadConsulta = 0;
  if ($idMesFiltro >= MITAD1_DESDE && $idMesFiltro <= MITAD1_HASTA) $mesMitadConsulta = ID_MES_1ER_MITAD;
  if ($idMesFiltro >= MITAD2_DESDE && $idMesFiltro <= MITAD2_HASTA) $mesMitadConsulta = ID_MES_2DA_MITAD;
  if ($idMesFiltro === ID_MES_1ER_MITAD) $mesMitadConsulta = ID_MES_1ER_MITAD;
  if ($idMesFiltro === ID_MES_2DA_MITAD) $mesMitadConsulta = ID_MES_2DA_MITAD;

  // ✅ ¿Incluimos inactivos?
  // solo si pedís pagados/condonados y filtrás por un mes concreto (incluye matrícula/mitades/anual también)
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
    // ✅ EXISTS contempla:
    // - mes consultado
    // - ANUAL (13)
    // - MITAD correspondiente (15/16) si aplica
    // - MATRÍCULA (14)
    $sqlAlu .= "
      WHERE a.activo = 1
         OR EXISTS (
              SELECT 1 FROM pagos p
               WHERE p.id_alumno = a.id_alumno
                 AND p.id_mes IN (:mes_consulta, :mes_anual, :mes_mitad, :mes_matricula)
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
    $stAlu->bindValue(':mes_mitad', $mesMitadConsulta ?: 0, PDO::PARAM_INT);
    $stAlu->bindValue(':mes_matricula', ID_MES_MATRICULA, PDO::PARAM_INT);
    $stAlu->bindValue(':anio_pagos', $anioFiltro, PDO::PARAM_INT);
  }

  $stAlu->execute();
  $alumnos = $stAlu->fetchAll(PDO::FETCH_ASSOC);

  // == Pagos del año ==
  $paramsPagos = [':anio' => $anioFiltro];

  // ✅ Si filtrás por un mes mensual (1..12) => traemos ese mes + anual + mitad correspondiente
  // ✅ Si filtrás por 15/16 => traemos ese + anual
  // ✅ Si filtrás por 14 (matrícula) => traemos SOLO matrícula
  // ✅ Si filtrás por anual (13) => traemos todo
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
    $paramsPagos[':matricula'] = ID_MES_MATRICULA;
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
      $paramsPagos[':mes']   = $idMesFiltro;
      $paramsPagos[':anual'] = ID_MES_ANUAL;
      $paramsPagos[':mitad'] = $mesMitadConsulta ?: 0; // 0 no matchea nada
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
    $stPag->bindValue($k, $v, is_int($v) ? PDO::PARAM_INT : PDO::PARAM_STR);
  }
  $stPag->execute();
  $pagos = $stPag->fetchAll(PDO::FETCH_ASSOC);

  // Indexación de pagos
  $pagoDirecto   = []; // [id_alumno][id_mes] = 'pagado'|'condonado'
  $pagoAnual     = []; // [id_alumno]        = 'pagado'|'condonado'
  $pagoMatricula = []; // [id_alumno]        = 'pagado'|'condonado'
  $pagoMitad1    = []; // [id_alumno]        = 'pagado'|'condonado'
  $pagoMitad2    = []; // [id_alumno]        = 'pagado'|'condonado'

  foreach ($pagos as $p) {
    $ida = (int)$p['id_alumno'];
    $idm = (int)$p['id_mes'];
    $est = ($p['estado'] === 'condonado') ? 'condonado' : 'pagado';

    if ($idm === ID_MES_ANUAL) {
      $pagoAnual[$ida] = $est;
      continue;
    }
    if ($idm === ID_MES_MATRICULA) {
      $pagoMatricula[$ida] = $est;
      continue;
    }
    if ($idm === ID_MES_1ER_MITAD) {
      $pagoMitad1[$ida] = $est;
      continue;
    }
    if ($idm === ID_MES_2DA_MITAD) {
      $pagoMitad2[$ida] = $est;
      continue;
    }

    // pagos mensuales normales
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
      // referencia suave: enero del año de pago
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
      ];
      continue;
    }

    // ==========================
    // ✅ Meses 1..12 (normal)
    // ==========================
    $listaMeses = range(1, 12);
    if ($idMesFiltro > 0 && $idMesFiltro !== ID_MES_ANUAL) {
      // si filtran un mes específico (1..12), devolvemos solo ese
      $listaMeses = [$idMesFiltro];
    }

    foreach ($listaMeses as $idm) {
      $idm = (int)$idm;
      if ($idm < 1 || $idm > 12) continue;

      if (!alumnoElegible($a, $idm, $anioFiltro)) continue;

      // Estado (prioridad):
      // 1) pago directo del mes
      // 2) pago anual (cubre todo)
      // 3) pago 1er mitad si el mes está en 3..7
      // 4) pago 2da mitad si el mes está en 8..12
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
      ];
    }
  }

  echo json_encode(['exito' => true, 'cuotas' => $cuotas], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  http_response_code(200);
  echo json_encode(['exito' => false, 'mensaje' => 'Error al obtener cuotas: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}