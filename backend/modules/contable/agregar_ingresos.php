<?php
/**
 * backend/modules/contable/agregar_ingresos.php
 *
 * GET  -> sincroniza ventas aprobadas y lista ingresos reales + ventas faltantes como respaldo.
 * POST -> crea un ingreso manual.
 *
 * Regla clave:
 * - La tabla ingresos se muestra siempre. No se ocultan filas por parecer ventas.
 * - Las ventas escolares se sincronizan de forma idempotente antes de listar.
 * - Si una venta aprobada todavía no pudo impactar en ingresos, se agrega como fila virtual de respaldo.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

try {
    if (!isset($pdo)) {
        require_once __DIR__ . '/../../config/db.php';
    }
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    // Reutilizamos la sincronización segura del módulo Ventas.
    // No rompe si el módulo todavía no existe en una instalación vieja.
    $ventasHelpers = __DIR__ . '/../ventas/helpers.php';
    if (is_file($ventasHelpers)) {
        require_once $ventasHelpers;
    }

    $tableExists = function(PDO $pdo, string $table): bool {
        try {
            $st = $pdo->prepare("SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t LIMIT 1");
            $st->execute([':t' => $table]);
            return (bool)$st->fetchColumn();
        } catch (Throwable $e) {
            return false;
        }
    };

    $columnExists = function(PDO $pdo, string $table, string $column): bool {
        try {
            $st = $pdo->prepare("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c LIMIT 1");
            $st->execute([':t' => $table, ':c' => $column]);
            return (bool)$st->fetchColumn();
        } catch (Throwable $e) {
            return false;
        }
    };

    $normalizarImporte = function($raw): float {
        $txt = trim((string)$raw);
        if ($txt === '') return 0.0;
        $txt = str_replace(['$', ' '], '', $txt);
        if (strpos($txt, ',') !== false && strpos($txt, '.') !== false) {
            $txt = str_replace('.', '', $txt);
            $txt = str_replace(',', '.', $txt);
        } else {
            $txt = str_replace(',', '.', $txt);
        }
        return is_numeric($txt) ? (float)$txt : 0.0;
    };

    /* =======================
       GET: listar ingresos
    ======================== */
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $year  = isset($_GET['year'])  ? (int)$_GET['year']  : (int)date('Y');
        $month = isset($_GET['month']) ? (int)$_GET['month'] : 0;
        $start = isset($_GET['start']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$_GET['start']) ? (string)$_GET['start'] : '';
        $end   = isset($_GET['end'])   && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$_GET['end'])   ? (string)$_GET['end']   : '';
        $todosLosAnios = isset($_GET['all']) && (int)$_GET['all'] === 1;

        if ($year < 2000 || $year > 2100) {
            $year = (int)date('Y');
        }

        $warnings = [];

        // Al entrar a Ingresos dejamos impactadas las ventas aprobadas en la tabla ingresos.
        // La función es idempotente: si ya existe el ingreso vinculado, lo actualiza; no crea otro.
        if ($tableExists($pdo, 'ventas_ordenes') && function_exists('ventas_sincronizar_contable_ventas_aprobadas')) {
            try {
                ventas_sincronizar_contable_ventas_aprobadas($pdo);
            } catch (Throwable $e) {
                $warnings[] = 'No se pudo sincronizar ventas aprobadas con ingresos: ' . $e->getMessage();
            }
        }

        if ($start !== '' && $end !== '') {
            $whereIngresos = "i.fecha BETWEEN :start AND :end";
            $paramsIngresos = [':start' => $start, ':end' => $end];
        } elseif ($todosLosAnios) {
            $whereIngresos = "1=1";
            $paramsIngresos = [];
        } else {
            $whereIngresos = "YEAR(i.fecha) = :y";
            $paramsIngresos = [':y' => $year];
            if ($month >= 1 && $month <= 12) {
                $whereIngresos .= " AND MONTH(i.fecha) = :m";
                $paramsIngresos[':m'] = $month;
            }
        }

        $items = [];

        if ($tableExists($pdo, 'ingresos')) {
            $sqlIngresos = "
                SELECT
                    i.id_ingreso,
                    DATE_FORMAT(i.fecha, '%Y-%m-%d') AS fecha,
                    i.id_cont_categoria,
                    COALESCE(cc.nombre_categoria, '') AS categoria,
                    i.id_cont_proveedor,
                    COALESCE(cp.nombre_proveedor, '') AS proveedor,
                    i.id_cont_descripcion,
                    COALESCE(cd.nombre_descripcion, '') AS descripcion,
                    i.id_medio_pago,
                    COALESCE(mp.medio_pago, '—') AS medio_pago,
                    COALESCE(i.importe,0) AS importe,
                    NULL AS id_venta_orden,
                    NULL AS venta_codigo,
                    CASE
                      WHEN UPPER(COALESCE(cc.nombre_categoria,'')) LIKE 'VENTA%'
                        OR UPPER(COALESCE(cd.nombre_descripcion,'')) LIKE 'VENTA%'
                      THEN 'venta'
                      ELSE 'manual'
                    END AS origen_contable
                FROM ingresos i
                LEFT JOIN contable_categoria   cc ON cc.id_cont_categoria   = i.id_cont_categoria
                LEFT JOIN contable_proveedor   cp ON cp.id_cont_proveedor   = i.id_cont_proveedor
                LEFT JOIN contable_descripcion cd ON cd.id_cont_descripcion = i.id_cont_descripcion
                LEFT JOIN medio_pago           mp ON mp.id_medio_pago       = i.id_medio_pago
                WHERE $whereIngresos
                ORDER BY i.fecha ASC, i.id_ingreso ASC
            ";
            $st = $pdo->prepare($sqlIngresos);
            $st->execute($paramsIngresos);
            $items = $st->fetchAll(PDO::FETCH_ASSOC);
        }

        /*
         * Ventas aprobadas faltantes:
         * Las agregamos solo si no hay un ingreso equivalente. Esto evita dos problemas:
         * 1) Si ventas ya impactó en ingresos, se muestra una sola vez.
         * 2) Si ventas todavía no impactó, igualmente aparece en Contable.
         * Si esta consulta falla por diferencias de esquema, NO rompemos la pestaña Ingresos.
         */
        if ($tableExists($pdo, 'ventas_ordenes')) {
            try {
                $hayCampanias = $tableExists($pdo, 'ventas_campanias');
                $tieneIdIngreso = $columnExists($pdo, 'ventas_ordenes', 'id_ingreso');
                $tieneAprobadoEn = $columnExists($pdo, 'ventas_ordenes', 'aprobado_en');
                $tieneActualizadoEn = $columnExists($pdo, 'ventas_ordenes', 'actualizado_en');
                $tieneCreadoEn = $columnExists($pdo, 'ventas_ordenes', 'creado_en');

                $fechaExprParts = [];
                if ($tieneAprobadoEn) $fechaExprParts[] = 'vo.aprobado_en';
                if ($tieneActualizadoEn) $fechaExprParts[] = 'vo.actualizado_en';
                if ($tieneCreadoEn) $fechaExprParts[] = 'vo.creado_en';
                $fechaExpr = count($fechaExprParts) ? 'COALESCE(' . implode(', ', $fechaExprParts) . ')' : 'CURRENT_DATE()';

                if ($start !== '' && $end !== '') {
                    $whereVentas = "DATE($fechaExpr) BETWEEN :vstart AND :vend";
                    $paramsVentas = [':vstart' => $start, ':vend' => $end];
                } elseif ($todosLosAnios) {
                    $whereVentas = "1=1";
                    $paramsVentas = [];
                } else {
                    $whereVentas = "YEAR($fechaExpr) = :vy";
                    $paramsVentas = [':vy' => $year];
                    if ($month >= 1 && $month <= 12) {
                        $whereVentas .= " AND MONTH($fechaExpr) = :vm";
                        $paramsVentas[':vm'] = $month;
                    }
                }

                $joinCampania = $hayCampanias ? "LEFT JOIN ventas_campanias vc ON vc.id_campania = vo.id_campania" : "";
                $selectCampania = $hayCampanias ? "COALESCE(NULLIF(vc.nombre,''), 'VENTA')" : "'VENTA'";
                $tieneContableExcluido = $columnExists($pdo, 'ventas_ordenes', 'contable_excluido');
                $notLinked = $tieneIdIngreso ? "AND (vo.id_ingreso IS NULL OR vo.id_ingreso = 0)" : "";
                $notExcluded = $tieneContableExcluido ? "AND COALESCE(vo.contable_excluido, 0) = 0" : "";

                $sqlVentas = "
                    SELECT
                        NULL AS id_ingreso,
                        DATE_FORMAT(DATE($fechaExpr), '%Y-%m-%d') AS fecha,
                        NULL AS id_cont_categoria,
                        'VENTAS' AS categoria,
                        NULL AS id_cont_proveedor,
                        COALESCE(NULLIF(vo.persona_nombre,''), 'VENTA') AS proveedor,
                        NULL AS id_cont_descripcion,
                        CONCAT('VENTA ', $selectCampania) AS descripcion,
                        vo.id_medio_pago,
                        COALESCE(mp.medio_pago, '—') AS medio_pago,
                        COALESCE(vo.total,0) AS importe,
                        vo.id_orden AS id_venta_orden,
                        vo.codigo_orden AS venta_codigo,
                        'venta' AS origen_contable
                    FROM ventas_ordenes vo
                    LEFT JOIN medio_pago mp ON mp.id_medio_pago = vo.id_medio_pago
                    $joinCampania
                    WHERE LOWER(TRIM(CAST(vo.estado AS CHAR))) = 'aprobada'
                      $notLinked
                      $notExcluded
                      AND $whereVentas
                      AND NOT EXISTS (
                        SELECT 1
                        FROM ingresos i2
                        LEFT JOIN contable_categoria   cc2 ON cc2.id_cont_categoria   = i2.id_cont_categoria
                        LEFT JOIN contable_proveedor   cp2 ON cp2.id_cont_proveedor   = i2.id_cont_proveedor
                        LEFT JOIN contable_descripcion cd2 ON cd2.id_cont_descripcion = i2.id_cont_descripcion
                        WHERE DATE(i2.fecha) = DATE($fechaExpr)
                          AND ABS(COALESCE(i2.importe,0) - COALESCE(vo.total,0)) < 0.01
                          AND (
                            UPPER(TRIM(COALESCE(cp2.nombre_proveedor,''))) = UPPER(TRIM(COALESCE(vo.persona_nombre,'')))
                            OR UPPER(TRIM(COALESCE(cc2.nombre_categoria,''))) LIKE 'VENTA%'
                            OR UPPER(TRIM(COALESCE(cd2.nombre_descripcion,''))) LIKE 'VENTA%'
                          )
                        LIMIT 1
                      )
                ";

                $stVentas = $pdo->prepare($sqlVentas);
                $stVentas->execute($paramsVentas);
                $ventasVirtuales = $stVentas->fetchAll(PDO::FETCH_ASSOC);
                if ($ventasVirtuales) {
                    $items = array_merge($items, $ventasVirtuales);
                }
            } catch (Throwable $e) {
                $warnings[] = 'No se pudieron sumar ventas virtuales: ' . $e->getMessage();
            }
        }

        usort($items, static function($a, $b) {
            $fa = (string)($a['fecha'] ?? '');
            $fb = (string)($b['fecha'] ?? '');
            if ($fa === $fb) {
                $ia = (int)($a['id_ingreso'] ?? 0);
                if ($ia <= 0) $ia = 100000000 + (int)($a['id_venta_orden'] ?? 0);
                $ib = (int)($b['id_ingreso'] ?? 0);
                if ($ib <= 0) $ib = 100000000 + (int)($b['id_venta_orden'] ?? 0);
                return $ia <=> $ib;
            }
            return strcmp($fa, $fb);
        });

        $aniosDisponibles = [];
        try {
            foreach ([
                "SELECT DISTINCT YEAR(fecha) AS y FROM ingresos WHERE fecha IS NOT NULL",
                "SELECT DISTINCT YEAR(fecha_pago) AS y FROM pagos WHERE fecha_pago IS NOT NULL",
                "SELECT DISTINCT YEAR(fecha) AS y FROM egresos WHERE fecha IS NOT NULL",
            ] as $sqlYear) {
                try {
                    $stY = $pdo->query($sqlYear);
                    while ($ry = $stY->fetch(PDO::FETCH_ASSOC)) {
                        if (!empty($ry['y'])) $aniosDisponibles[] = (int)$ry['y'];
                    }
                } catch (Throwable $e) {}
            }
            if ($tableExists($pdo, 'ventas_ordenes')) {
                $partsY = [];
                if ($columnExists($pdo, 'ventas_ordenes', 'aprobado_en')) $partsY[] = 'aprobado_en';
                if ($columnExists($pdo, 'ventas_ordenes', 'actualizado_en')) $partsY[] = 'actualizado_en';
                if ($columnExists($pdo, 'ventas_ordenes', 'creado_en')) $partsY[] = 'creado_en';
                if ($partsY) {
                    $fechaVentasYears = 'COALESCE(' . implode(', ', $partsY) . ')';
                    $excluidoYears = $columnExists($pdo, 'ventas_ordenes', 'contable_excluido') ? 'AND COALESCE(contable_excluido, 0) = 0' : '';
                    $stY = $pdo->query("SELECT DISTINCT YEAR($fechaVentasYears) AS y FROM ventas_ordenes WHERE LOWER(TRIM(CAST(estado AS CHAR))) = 'aprobada' $excluidoYears");
                    while ($ry = $stY->fetch(PDO::FETCH_ASSOC)) {
                        if (!empty($ry['y'])) $aniosDisponibles[] = (int)$ry['y'];
                    }
                }
            }
        } catch (Throwable $e) {}
        $aniosDisponibles[] = (int)date('Y');
        $aniosDisponibles = array_values(array_unique(array_filter($aniosDisponibles)));
        rsort($aniosDisponibles);

        echo json_encode([
            'exito' => true,
            'items' => $items,
            'anios_disponibles' => $aniosDisponibles,
            'warnings' => $warnings,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    /* =======================
       POST: crear ingreso
    ======================== */
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new InvalidArgumentException('JSON inválido.');
    }

    $fecha             = trim((string)($data['fecha'] ?? ''));
    $idContCategoria   = isset($data['id_cont_categoria'])   && $data['id_cont_categoria']   !== '' ? (int)$data['id_cont_categoria']   : null;
    $idContProveedor   = isset($data['id_cont_proveedor'])   && $data['id_cont_proveedor']   !== '' ? (int)$data['id_cont_proveedor']   : null;
    $idContDescripcion = isset($data['id_cont_descripcion']) && $data['id_cont_descripcion'] !== '' ? (int)$data['id_cont_descripcion'] : null;
    $idMedioPago       = isset($data['id_medio_pago']) ? (int)$data['id_medio_pago'] : 0;
    $importe           = $normalizarImporte($data['importe'] ?? null);

    if (!$fecha || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
        throw new InvalidArgumentException('fecha requerida con formato YYYY-MM-DD.');
    }
    if ($importe <= 0) {
        throw new InvalidArgumentException('importe inválido.');
    }
    if ($idMedioPago < 1) {
        throw new InvalidArgumentException('id_medio_pago requerido.');
    }

    $chk = $pdo->prepare("SELECT 1 FROM medio_pago WHERE id_medio_pago = :id");
    $chk->execute([':id' => $idMedioPago]);
    if (!$chk->fetchColumn()) {
        throw new InvalidArgumentException('id_medio_pago inexistente.');
    }

    if ($idContCategoria !== null) {
        $q = $pdo->prepare("SELECT 1 FROM contable_categoria WHERE id_cont_categoria = :id");
        $q->execute([':id' => $idContCategoria]);
        if (!$q->fetchColumn()) throw new InvalidArgumentException('id_cont_categoria inexistente.');
    }
    if ($idContProveedor !== null) {
        $q = $pdo->prepare("SELECT 1 FROM contable_proveedor WHERE id_cont_proveedor = :id");
        $q->execute([':id' => $idContProveedor]);
        if (!$q->fetchColumn()) throw new InvalidArgumentException('id_cont_proveedor inexistente.');
    }
    if ($idContDescripcion !== null) {
        $q = $pdo->prepare("SELECT 1 FROM contable_descripcion WHERE id_cont_descripcion = :id");
        $q->execute([':id' => $idContDescripcion]);
        if (!$q->fetchColumn()) throw new InvalidArgumentException('id_cont_descripcion inexistente.');
    }

    $sql = "
        INSERT INTO ingresos
            (fecha, id_cont_categoria, id_cont_proveedor, id_cont_descripcion, id_medio_pago, importe)
        VALUES
            (:fecha, :cat, :prov, :descr, :medio, :importe)
    ";
    $st = $pdo->prepare($sql);
    $st->bindValue(':fecha', $fecha, PDO::PARAM_STR);
    $st->bindValue(':cat', $idContCategoria, $idContCategoria === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    $st->bindValue(':prov', $idContProveedor, $idContProveedor === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    $st->bindValue(':descr', $idContDescripcion, $idContDescripcion === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    $st->bindValue(':medio', $idMedioPago, PDO::PARAM_INT);
    $st->bindValue(':importe', number_format($importe, 2, '.', ''), PDO::PARAM_STR);
    $st->execute();

    echo json_encode([
        'exito'      => true,
        'id_ingreso' => (int)$pdo->lastInsertId(),
        'mensaje'    => 'Ingreso registrado correctamente.'
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
