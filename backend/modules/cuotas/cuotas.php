<?php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json');

// Devuelve el número de mes (1-12) desde el nombre del mes
function obtenerMesNumero($nombreMes) {
    $meses = [
        'ENERO' => 1, 'FEBRERO' => 2, 'MARZO' => 3, 'ABRIL' => 4,
        'MAYO' => 5, 'JUNIO' => 6, 'JULIO' => 7, 'AGOSTO' => 8,
        'SEPTIEMBRE' => 9, 'OCTUBRE' => 10, 'NOVIEMBRE' => 11, 'DICIEMBRE' => 12
    ];
    return $meses[strtoupper($nombreMes)] ?? 1; // Por defecto enero
}

// Verifica si el socio ya estaba activo en el mes/año del período
function socioEstabaActivo($fechaIngreso, $mesPeriodo, $anioPeriodo) {
    if (!$fechaIngreso) $fechaIngreso = "$anioPeriodo-01-01";

    $fecha = new DateTime($fechaIngreso);
    $mesIngreso = (int)$fecha->format('m');
    $anioIngreso = (int)$fecha->format('Y');

    return ($anioIngreso < $anioPeriodo) || ($anioIngreso === $anioPeriodo && $mesIngreso <= $mesPeriodo);
}

try {
    // Año actual
    $anioActual = (int)date('Y');

    // Obtener socios activos
    $stmt = $pdo->prepare("
        SELECT 
            s.id_socio,
            s.nombre,
            s.domicilio,
            s.numero,
            s.domicilio_cobro,
            s.ingreso,
            c.nombre AS cobrador,
            e.descripcion AS estado
        FROM socios s
        LEFT JOIN cobrador c ON s.id_cobrador = c.id_cobrador
        LEFT JOIN estado e ON s.id_estado = e.id_estado
        WHERE s.activo = 1
        ORDER BY s.nombre ASC
    ");
    $stmt->execute();
    $socios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Obtener pagos registrados
    $pagosStmt = $pdo->prepare("SELECT id_socio, id_periodo FROM pagos");
    $pagosStmt->execute();
    $pagos = $pagosStmt->fetchAll(PDO::FETCH_ASSOC);

    $pagosPorSocio = [];
    foreach ($pagos as $pago) {
        $pagosPorSocio[$pago['id_socio']][] = $pago['id_periodo'];
    }

    // Obtener los períodos (sin columna 'mes', usamos la columna 'meses' para extraerlo)
    $periodosStmt = $pdo->prepare("SELECT id_periodo, nombre, meses FROM periodo ORDER BY id_periodo ASC");
    $periodosStmt->execute();
    $periodos = $periodosStmt->fetchAll(PDO::FETCH_ASSOC);

    $cuotas = [];

    foreach ($socios as $socio) {
        $id = $socio['id_socio'];
        $pagosHechos = $pagosPorSocio[$id] ?? [];

        foreach ($periodos as $periodo) {
            $idPeriodo = $periodo['id_periodo'];
            $nombrePeriodo = $periodo['nombre'];
            $textoMeses = strtoupper($periodo['meses']); // ej: "ENERO - FEBRERO"
            $mesInicio = obtenerMesNumero(explode(' ', $textoMeses)[0]); // Tomamos el primer mes del rango

            if (!socioEstabaActivo($socio['ingreso'], $mesInicio, $anioActual)) {
                continue;
            }

            $pagado = in_array($idPeriodo, $pagosHechos);

            $domicilioFinal = '';
            if (!empty($socio['domicilio_cobro'])) {
                $domicilioFinal = $socio['domicilio_cobro'];
            } elseif (!empty($socio['domicilio']) || !empty($socio['numero'])) {
                $domicilioFinal = trim(($socio['domicilio'] ?? '') . ' ' . ($socio['numero'] ?? ''));
            }

            $cuotas[] = [
                'id_socio'     => $id,
                'nombre'       => $socio['nombre'],
                'domicilio'    => $domicilioFinal,
                'estado'       => $socio['estado'] ?? 'No definido',
                'medio_pago'   => $socio['cobrador'] ?? 'No definido',
                'mes'          => $nombrePeriodo,
                'id_periodo'   => $idPeriodo,
                'estado_pago'  => $pagado ? 'pagado' : 'deudor'
            ];
        }
    }

    echo json_encode([
        'exito' => true,
        'cuotas' => $cuotas
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error al obtener cuotas: ' . $e->getMessage()
    ]);
}
