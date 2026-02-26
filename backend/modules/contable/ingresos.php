<?php
/**
 * backend/modules/contable/ingresos.php
 *
 * Unificado:
 * - CRUD ingresos (cuando viene ?op=create|update|get)
 * - Informe de pagos alumnos (cuando NO viene ?op)
 *
 * Endpoints:
 *   CRUD:
 *     POST  /api.php?action=contable_ingresos&op=create
 *     POST  /api.php?action=contable_ingresos&op=update
 *     GET   /api.php?action=contable_ingresos&op=get&id=#
 *
 *   Informe alumnos/pagos:
 *     GET   /api.php?action=contable_ingresos&year=YYYY&detalle=1
 *     GET   /api.php?action=contable_ingresos&start=YYYY-MM-DD&end=YYYY-MM-DD&detalle=1
 */

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

try {
    if (!isset($pdo)) {
        require_once __DIR__ . '/../../config/db.php';
    }
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    /* ========================= Helpers ========================= */
    $op = $_GET['op'] ?? $_POST['op'] ?? '';

    $json_ok = function(array $arr = []) {
        echo json_encode(['exito' => true] + $arr, JSON_UNESCAPED_UNICODE);
        exit;
    };
    $json_err = function(string $msg, int $code = 500) {
        http_response_code($code);
        echo json_encode(['exito' => false, 'mensaje' => $msg], JSON_UNESCAPED_UNICODE);
        exit;
    };

    $tableExists = function(PDO $pdo, string $table): bool {
        try {
            $st = $pdo->prepare("SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t");
            $st->execute([':t' => $table]);
            return (bool)$st->fetchColumn();
        } catch (Throwable $e) { return false; }
    };
    $columnExists = function(PDO $pdo, string $table, string $column): bool {
        try {
            $st = $pdo->prepare("SELECT 1
                                 FROM INFORMATION_SCHEMA.COLUMNS
                                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c");
            $st->execute([':t' => $table, ':c' => $column]);
            return (bool)$st->fetchColumn();
        } catch (Throwable $e) { return false; }
    };

    /**
     * Normaliza un importe (string o número) aceptando coma o punto.
     * Devuelve string con 2 decimales y punto (ej: "1234.56") listo para DECIMAL.
     * Lanza error si no es válido o <= 0.
     */
    $normalizarImporte = function($raw) use ($json_err): string {
        if ($raw === null || $raw === '') $json_err('importe requerido', 400);
        $clean = str_replace(',', '.', (string)$raw);
        if (!preg_match('/^\d+(?:\.\d+)?$/', $clean)) {
            $json_err('importe inválido', 400);
        }
        $float = (float)$clean;
        if (!is_finite($float) || $float <= 0) {
            $json_err('importe inválido', 400);
        }
        return number_format($float, 2, '.', '');
    };

    /* ========================= CRUD ingresos ========================= */
    if ($op === 'get' || $op === 'create' || $op === 'update') {

        if ($op === 'get') {
            $id = (int)($_GET['id'] ?? 0);
            if ($id <= 0) $json_err('id inválido', 400);

            $q = $pdo->prepare("
                SELECT
                  i.id_ingreso,
                  DATE_FORMAT(i.fecha,'%Y-%m-%d') AS fecha,
                  i.id_cont_categoria,
                  i.id_cont_proveedor,
                  i.id_cont_descripcion,
                  i.id_medio_pago,
                  i.importe
                FROM ingresos i
                WHERE i.id_ingreso = :id
                LIMIT 1
            ");
            $q->execute([':id' => $id]);
            $row = $q->fetch(PDO::FETCH_ASSOC);
            if (!$row) $json_err('Ingreso no encontrado', 404);

            $json_ok(['data' => $row]);
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $json_err('Usá POST', 405);
        $in = json_decode(file_get_contents('php://input'), true) ?: [];

        $fecha = trim((string)($in['fecha'] ?? ''));
        $idContCategoria   = isset($in['id_cont_categoria'])   && $in['id_cont_categoria']   !== '' ? (int)$in['id_cont_categoria']   : null;
        $idContProveedor   = isset($in['id_cont_proveedor'])   && $in['id_cont_proveedor']   !== '' ? (int)$in['id_cont_proveedor']   : null;
        $idContDescripcion = isset($in['id_cont_descripcion']) && $in['id_cont_descripcion'] !== '' ? (int)$in['id_cont_descripcion'] : null;
        $idMedioPago = (int)($in['id_medio_pago'] ?? 0);
        $importe = $normalizarImporte($in['importe'] ?? null);

        if (!$fecha || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) $json_err('fecha requerida YYYY-MM-DD', 400);
        if ($idMedioPago < 1)                                      $json_err('id_medio_pago requerido', 400);

        $chk = $pdo->prepare("SELECT 1 FROM medio_pago WHERE id_medio_pago = :id");
        $chk->execute([':id' => $idMedioPago]);
        if (!$chk->fetchColumn()) $json_err('id_medio_pago inexistente', 400);

        if ($idContCategoria !== null) {
            $q = $pdo->prepare("SELECT 1 FROM contable_categoria WHERE id_cont_categoria = :id");
            $q->execute([':id' => $idContCategoria]);
            if (!$q->fetchColumn()) $json_err('id_cont_categoria inexistente', 400);
        }
        if ($idContProveedor !== null) {
            $q = $pdo->prepare("SELECT 1 FROM contable_proveedor WHERE id_cont_proveedor = :id");
            $q->execute([':id' => $idContProveedor]);
            if (!$q->fetchColumn()) $json_err('id_cont_proveedor inexistente', 400);
        }
        if ($idContDescripcion !== null) {
            $q = $pdo->prepare("SELECT 1 FROM contable_descripcion WHERE id_cont_descripcion = :id");
            $q->execute([':id' => $idContDescripcion]);
            if (!$q->fetchColumn()) $json_err('id_cont_descripcion inexistente', 400);
        }

        if ($op === 'create') {
            $st = $pdo->prepare("
                INSERT INTO ingresos (fecha, id_cont_categoria, id_cont_proveedor, id_cont_descripcion, id_medio_pago, importe)
                VALUES (:fecha, :cat, :prov, :descr, :medio, :importe)
            ");
            $st->bindValue(':fecha',  $fecha, PDO::PARAM_STR);
            $st->bindValue(':cat',    $idContCategoria,   is_null($idContCategoria)   ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $st->bindValue(':prov',   $idContProveedor,   is_null($idContProveedor)   ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $st->bindValue(':descr',  $idContDescripcion, is_null($idContDescripcion) ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $st->bindValue(':medio',  $idMedioPago, PDO::PARAM_INT);
            $st->bindValue(':importe', $importe, PDO::PARAM_STR);
            $st->execute();

            $json_ok(['id' => $pdo->lastInsertId()]);
        }

        if ($op === 'update') {
            $idIngreso = (int)($in['id_ingreso'] ?? 0);
            if ($idIngreso <= 0) $json_err('id_ingreso inválido', 400);

            $st = $pdo->prepare("
                UPDATE ingresos
                   SET fecha = :fecha,
                       id_cont_categoria   = :cat,
                       id_cont_proveedor   = :prov,
                       id_cont_descripcion = :descr,
                       id_medio_pago       = :medio,
                       importe             = :importe
                 WHERE id_ingreso = :id
            ");
            $st->bindValue(':fecha',  $fecha, PDO::PARAM_STR);
            $st->bindValue(':cat',    $idContCategoria,   is_null($idContCategoria)   ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $st->bindValue(':prov',   $idContProveedor,   is_null($idContProveedor)   ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $st->bindValue(':descr',  $idContDescripcion, is_null($idContDescripcion) ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $st->bindValue(':medio',  $idMedioPago, PDO::PARAM_INT);
            $st->bindValue(':importe', $importe, PDO::PARAM_STR);
            $st->bindValue(':id',     $idIngreso, PDO::PARAM_INT);
            $st->execute();

            $json_ok();
        }
    }

    /* ========================= Informe alumnos/pagos ========================= */
    $yearParam = $_GET['year'] ?? null;
    $hasYearParam = $yearParam !== null && $yearParam !== '';

    $year = $hasYearParam ? (int)$yearParam : (int)date('Y');
    $wantDetalle = isset($_GET['detalle']) && (int)$_GET['detalle'] === 1;

    $start = $_GET['start'] ?? null;
    $end   = $_GET['end']   ?? null;

    if ($start && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $start)) $start = null;
    if ($end   && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end))   $end   = null;

    // catálogo de meses
    $mesCat = [];
    $stMes = $pdo->query("SELECT id_mes, nombre FROM meses ORDER BY id_mes ASC");
    foreach ($stMes->fetchAll(PDO::FETCH_ASSOC) as $m) {
        $mesCat[(int)$m['id_mes']] = (string)$m['nombre'];
    }

    // años disponibles - pagos + ingresos
    $stYearsPagos = $pdo->query("
        SELECT DISTINCT YEAR(fecha_pago) AS anio
        FROM pagos
        WHERE UPPER(estado)='PAGADO'
        ORDER BY anio DESC
    ");
    $aniosPagos = array_map(static fn($r) => (int)$r['anio'], $stYearsPagos->fetchAll(PDO::FETCH_ASSOC));

    $stYearsIngresos = $pdo->query("
        SELECT DISTINCT YEAR(fecha) AS anio
        FROM ingresos
        ORDER BY anio DESC
    ");
    $aniosIngresos = array_map(static fn($r) => (int)$r['anio'], $stYearsIngresos->fetchAll(PDO::FETCH_ASSOC));

    $aniosDisponibles = array_unique(array_merge($aniosPagos, $aniosIngresos));
    rsort($aniosDisponibles);
    if (empty($aniosDisponibles)) $aniosDisponibles = [$year];
    if ($hasYearParam && !in_array($year, $aniosDisponibles, true)) {
        $aniosDisponibles[] = $year;
        rsort($aniosDisponibles);
    }

    // detectar columnas en alumnos
    $nombreCandidates   = ['nombre', 'nombres', 'nombre_alumno'];
    $apellidoCandidates = ['apellido', 'apellidos', 'apellido_alumno'];

    $nombreCol = null;
    foreach ($nombreCandidates as $c) if ($columnExists($pdo, 'alumnos', $c)) { $nombreCol = $c; break; }
    if (!$nombreCol) $nombreCol = $nombreCandidates[0];

    $apellidoCol = null;
    foreach ($apellidoCandidates as $c) if ($columnExists($pdo, 'alumnos', $c)) { $apellidoCol = $c; break; }
    if (!$apellidoCol) $apellidoCol = $apellidoCandidates[0];

    // detectar tabla y columna de categoría
    $categoriaTable = null;
    if ($tableExists($pdo, 'categoria'))          $categoriaTable = 'categoria';
    elseif ($tableExists($pdo, 'categorias'))     $categoriaTable = 'categorias';

    $catNameCol = null;
    if ($categoriaTable) {
        foreach (['nombre_categoria','Nombre_Categoria','nombre'] as $c) {
            if ($columnExists($pdo, $categoriaTable, $c)) { $catNameCol = $c; break; }
        }
        if (!$catNameCol) $categoriaTable = null;
    }

    $selectNombre    = $columnExists($pdo, 'alumnos', $nombreCol)   ? "a.`$nombreCol` AS nombre_alumno"      : "NULL AS nombre_alumno";
    $selectApellido  = $columnExists($pdo, 'alumnos', $apellidoCol) ? "a.`$apellidoCol` AS apellido_alumno"  : "NULL AS apellido_alumno";
    $joinCategoria   = $categoriaTable ? "LEFT JOIN `$categoriaTable` c ON c.id_categoria = a.id_categoria"   : "";
    $selectCategoria = $categoriaTable ? "c.`$catNameCol` AS nombre_categoria"                                 : "NULL AS nombre_categoria";

    // WHERE (filtrado por fecha_pago, como ya lo tenías)
    $where = "UPPER(p.estado)='PAGADO'";
    $params = [];

    if ($start && $end) {
        $where .= " AND p.fecha_pago BETWEEN :start AND :end";
        $params[':start'] = $start;
        $params[':end']   = $end;
    } elseif ($hasYearParam) {
        $where .= " AND YEAR(p.fecha_pago)=:y";
        $params[':y'] = $year;
    }

    // ✅ NUEVO: traer anio_aplicado
    $sql = "
        SELECT
            p.id_pago,
            p.fecha_pago,
            p.monto_pago,
            p.id_mes,
            p.anio_aplicado,
            p.id_medio_pago,
            mp.medio_pago AS medio_texto,
            a.id_alumno,
            $selectNombre,
            $selectApellido,
            a.id_categoria,
            $selectCategoria
        FROM pagos p
        LEFT JOIN alumnos a   ON a.id_alumno = p.id_alumno
        $joinCategoria
        LEFT JOIN medio_pago mp ON mp.id_medio_pago = p.id_medio_pago
        WHERE $where
        ORDER BY p.fecha_pago ASC, p.id_pago ASC
    ";

    $st = $pdo->prepare($sql);
    $st->execute($params);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    $resumen = [];
    $accMes  = [];
    $detalle = [];

    foreach ($rows as $r) {
        $fecha  = (string)$r['fecha_pago'];
        $monto  = (int)$r['monto_pago'];
        $mesNum = (int)$r['id_mes'];

        $y = (int)substr($fecha, 0, 4);
        $m = (int)substr($fecha, 5, 2);
        $key = sprintf('%04d-%02d', $y, $m);

        if (!isset($accMes[$key])) $accMes[$key] = ['anio'=>$y, 'mes'=>$m, 'ingresos'=>0, 'cantidad'=>0];
        $accMes[$key]['ingresos'] += $monto;
        $accMes[$key]['cantidad'] += 1;

        if ($wantDetalle) {
            if (!isset($detalle[$key])) $detalle[$key] = [];

            $nombre   = trim((string)($r['nombre_alumno'] ?? ''));
            $apellido = trim((string)($r['apellido_alumno'] ?? ''));
            $alumno   = trim(($nombre . ' ' . $apellido)) ?: '(SIN ALUMNO)';

            $catNom   = (string)($r['nombre_categoria'] ?? '');
            if ($catNom === '' || $catNom === null) $catNom = 'SIN CATEGORÍA';

            $medioTxt = (string)($r['medio_texto'] ?? '');
            if ($medioTxt === '') $medioTxt = '—';

            // ✅ NUEVO: texto "MES / AÑO" usando anio_aplicado si existe
            $anioAplicado = (int)($r['anio_aplicado'] ?? 0);
            if ($anioAplicado <= 0) $anioAplicado = (int)substr($fecha, 0, 4);

            $mesNom = (string)($mesCat[$mesNum] ?? '');
            if ($mesNom === '') $mesNom = (string)$mesNum;

            $detalle[$key][] = [
                'fecha_pago'     => $fecha,
                'Alumno'         => $alumno,
                'Categoria'      => $catNom,
                'Monto'          => $monto,
                'Mes_pagado'     => $mesNom . ' / ' . $anioAplicado,
                'Mes_pagado_id'  => $mesNum,
                'Mes_pagado_anio'=> $anioAplicado,
                'Medio'          => $medioTxt,
            ];
        }
    }

    // Resumen 12 meses (sin romper tu estructura)
    for ($m = 1; $m <= 12; $m++) {
        $key = sprintf('%04d-%02d', $year, $m);
        $ing = isset($accMes[$key]) ? (int)$accMes[$key]['ingresos'] : 0;
        $cnt = isset($accMes[$key]) ? (int)$accMes[$key]['cantidad'] : 0;
        $resumen[] = [
            'anio'        => $year,
            'mes'         => $m,
            'nombre_mes'  => isset($mesCat[$m]) ? (string)$mesCat[$m] : '',
            'ingresos'    => $ing,
            'cantidad'    => $cnt,
        ];
    }

    $meses_catalogo = [];
    foreach ($mesCat as $id => $nom) {
        $meses_catalogo[] = ['id_mes' => (int)$id, 'nombre' => (string)$nom];
    }

    $json_ok([
        'filtros'           => [
            'year'  => $hasYearParam ? $year : null,
            'start' => $start,
            'end'   => $end,
        ],
        'resumen'           => $resumen,
        'detalle'           => $wantDetalle ? $detalle : (object)[],
        'meses_catalogo'    => $meses_catalogo,
        'anios_disponibles' => $aniosDisponibles,
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'Error: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
}