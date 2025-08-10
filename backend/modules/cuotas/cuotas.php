<?php
// backend/modules/cuotas/obtener_cuotas_alumnos.php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

/**
 * ¿El alumno ya estaba activo en el mes/año indicado?
 * - ingreso: DATE (yyyy-mm-dd)
 * - mesPeriodo: 1..12
 * - anioPeriodo: yyyy
 */
function alumnoEstabaActivo(?string $ingreso, int $mesPeriodo, int $anioPeriodo): bool {
    if (!$ingreso) {
        // Si no hay fecha, consideramos 1 de enero del año del período
        $ingreso = sprintf('%04d-01-01', $anioPeriodo);
    }
    try {
        $f = new DateTime($ingreso);
    } catch (Throwable $e) {
        // Si la fecha viene mal, lo consideramos activo desde enero del año del período
        $f = new DateTime(sprintf('%04d-01-01', $anioPeriodo));
    }

    $mesIng  = (int)$f->format('m');
    $anioIng = (int)$f->format('Y');

    return ($anioIng < $anioPeriodo) || ($anioIng === $anioPeriodo && $mesIng <= $mesPeriodo);
}

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $anioActual = (int)date('Y');

    /* ===========================
       1) Alumnos activos
       =========================== */
    $sqlAlu = "
        SELECT
            a.id_alumno,
            a.apellido_nombre,
            a.dni,
            a.domicilio,
            a.localidad,
            a.telefono,
            a.id_año,
            a.id_division,
            a.id_categoria,
            a.activo,
            a.ingreso
        FROM alumnos a
        WHERE a.activo = 1
        ORDER BY a.apellido_nombre ASC
    ";
    $stAlu = $pdo->query($sqlAlu);
    $alumnos = $stAlu->fetchAll(PDO::FETCH_ASSOC);

    /* ===========================
       2) Pagos del año actual
       =========================== */
    $sqlPagos = "
        SELECT p.id_alumno, p.id_mes
        FROM pagos p
        WHERE YEAR(p.fecha_pago) = :anio
    ";
    $stPagos = $pdo->prepare($sqlPagos);
    $stPagos->execute([':anio' => $anioActual]);
    $pagos = $stPagos->fetchAll(PDO::FETCH_ASSOC);

    // Indexamos pagos por alumno -> set de meses pagados
    $pagosPorAlumno = [];
    foreach ($pagos as $p) {
        $ida = (int)$p['id_alumno'];
        $mes = (int)$p['id_mes'];
        if (!isset($pagosPorAlumno[$ida])) {
            $pagosPorAlumno[$ida] = [];
        }
        $pagosPorAlumno[$ida][$mes] = true;
    }

    /* ===========================
       3) Meses
       =========================== */
    $sqlMeses = "SELECT id_mes, nombre FROM meses ORDER BY id_mes ASC";
    $stMeses = $pdo->query($sqlMeses);
    $meses = $stMeses->fetchAll(PDO::FETCH_ASSOC);

    /* ===========================
       4) Construcción de cuotas
       =========================== */
    $cuotas = [];

    foreach ($alumnos as $a) {
        $idAlumno = (int)$a['id_alumno'];
        $pagosHechos = $pagosPorAlumno[$idAlumno] ?? [];

        foreach ($meses as $m) {
            $idMes = (int)$m['id_mes'];
            $nombreMes = (string)$m['nombre'];

            // Solo listar si ya estaba activo en ese mes del año actual
            if (!alumnoEstabaActivo($a['ingreso'] ?? null, $idMes, $anioActual)) {
                continue;
            }

            $pagado = !empty($pagosHechos[$idMes]);

            // Campos esperados por el frontend:
            // - nombre (o socio), dni/documento, domicilio
            // - estado (texto), medio_pago (si no hay, dejamos en vacío o null)
            // - id_mes (compatible con helpers), id_año/id_anio, id_division, id_categoria
            // - estado_pago: 'pagado' | 'deudor'
            $cuotas[] = [
                'id_alumno'     => $idAlumno,
                'nombre'        => (string)$a['apellido_nombre'],
                'dni'           => (string)$a['dni'],
                'domicilio'     => (string)($a['domicilio'] ?? ''),
                'estado'        => 'ACTIVO',
                'medio_pago'    => '', // no aplica en alumnos; el frontend muestra "Sin especificar"
                'mes'           => $nombreMes,
                'id_mes'        => $idMes,
                // ids para filtros
                'id_año'        => (int)$a['id_año'],     // mantiene compat con backticks si los usás
                'id_anio'       => (int)$a['id_año'],     // alias por si el frontend usa id_anio
                'id_division'   => (int)$a['id_division'],
                'id_categoria'  => (int)$a['id_categoria'],
                // estado de pago
                'estado_pago'   => $pagado ? 'pagado' : 'deudor',
            ];
        }
    }

    echo json_encode([
        'exito'  => true,
        'cuotas' => $cuotas,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al obtener cuotas de alumnos: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
