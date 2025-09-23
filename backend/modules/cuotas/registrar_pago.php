<?php
// modules/pagos/registrar_pago.php
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $payload = json_decode(file_get_contents('php://input'), true) ?: [];

    $idAlumno     = isset($payload['id_alumno']) ? (int)$payload['id_alumno'] : 0;
    $periodos     = isset($payload['periodos']) && is_array($payload['periodos']) ? $payload['periodos'] : [];
    $condonar     = !empty($payload['condonar']);
    $anioInput    = isset($payload['anio']) ? (int)$payload['anio'] : (int)date('Y');

    // Compatibilidad: monto_libre / monto_unitario
    $montoLibre   = isset($payload['monto_libre']) ? (int)$payload['monto_libre'] : 0;
    $montoUI      = isset($payload['monto_unitario']) ? (int)$payload['monto_unitario'] : null;

    // NUEVO: montos por período (incluye 13 y 14)
    $montosPorPeriodo = [];
    if (isset($payload['montos_por_periodo']) && is_array($payload['montos_por_periodo'])) {
        foreach ($payload['montos_por_periodo'] as $k => $v) {
            $kk = (int)$k;
            $vv = (int)$v;
            $montosPorPeriodo[$kk] = $vv;
        }
    }

    if ($idAlumno <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID de alumno inválido']);
        exit;
    }
    if (empty($periodos)) {
        echo json_encode(['exito' => false, 'mensaje' => 'No se enviaron períodos a registrar']);
        exit;
    }
    if ($anioInput < 2000 || $anioInput > 2100) {
        $anioInput = (int)date('Y');
    }

    $estadoRegistrar = $condonar ? 'condonado' : 'pagado';

    // FECHA DE PAGO: mismo día/mes de hoy, año = $anioInput (seleccionado)
    $hoy = new DateTime();
    $diaActual   = (int)$hoy->format('d');
    $mesActual   = (int)$hoy->format('m');
    $fechaPagoStr = sprintf('%04d-%02d-%02d', $anioInput, $mesActual, $diaActual);

    $pdo->beginTransaction();

    // Evitar duplicados del mismo alumno/año
    $stExist = $pdo->prepare("
        SELECT id_mes, estado
          FROM cooperadora.pagos
         WHERE id_alumno = :id_alumno
           AND YEAR(fecha_pago) = :anio
    ");
    $stExist->execute([
        ':id_alumno' => $idAlumno,
        ':anio'      => $anioInput,
    ]);
    $existentes = $stExist->fetchAll(PDO::FETCH_ASSOC);

    $yaPorMes = []; // [id_mes] => estado
    foreach ($existentes as $row) {
        $yaPorMes[(int)$row['id_mes']] = (string)$row['estado'];
    }

    // Resolver monto:
    // - condonado => 0
    // - si existe monto específico en montos_por_periodo[id] => usarlo
    // - si no existe, usar monto_unitario (>0)
    // - si no, usar monto_libre (>0)
    // - si no, 0
    $resolverMonto = function(bool $condonar, ?int $montoUI, int $montoLibre, array $montos, int $periodo) : int {
        if ($condonar) return 0;
        if (isset($montos[$periodo]) && is_int($montos[$periodo]) && $montos[$periodo] >= 0) {
            return (int)$montos[$periodo];
        }
        if (is_int($montoUI) && $montoUI > 0) return $montoUI;
        if ($montoLibre > 0) return $montoLibre;
        return 0;
    };

    $stIns = $pdo->prepare("
        INSERT INTO cooperadora.pagos (id_alumno, id_mes, fecha_pago, estado, monto_pago)
        VALUES (:id_alumno, :id_mes, :fecha_pago, :estado, :monto_pago)
    ");

    $insertados = 0;
    $yaRegistrados = [];

    // Períodos válidos: 1..12 (meses), 13 (Contado Anual), 14 (Matrícula)
    $validos = array_fill(1, 14, true);

    foreach ($periodos as $mesId) {
        $mes = (int)$mesId;

        if (!isset($validos[$mes])) {
            // Ignorar cualquier id_mes que no sea 1..14
            continue;
        }

        if (array_key_exists($mes, $yaPorMes)) {
            $yaRegistrados[] = [
                'periodo' => $mes,
                'estado'  => $yaPorMes[$mes],
            ];
            continue;
        }

        $montoPago = $resolverMonto($condonar, $montoUI, $montoLibre, $montosPorPeriodo, $mes);

        $stIns->execute([
            ':id_alumno'  => $idAlumno,
            ':id_mes'     => $mes,               // <-- aquí entran 13 (anual) y 14 (matrícula) también
            ':fecha_pago' => $fechaPagoStr,
            ':estado'     => $estadoRegistrar,
            ':monto_pago' => $montoPago,
        ]);
        $insertados++;
    }

    $pdo->commit();

    if ($insertados > 0) {
        echo json_encode([
            'exito'          => true,
            'insertados'     => $insertados,
            'ya_registrados' => $yaRegistrados,
        ], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode([
            'exito'          => false,
            'mensaje'        => 'No se insertaron registros (todos ya estaban cargados para ese año).',
            'ya_registrados' => $yaRegistrados,
        ], JSON_UNESCAPED_UNICODE);
    }

} catch (Throwable $e) {
    if (isset($pdo) && ($pdo instanceof PDO) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(200);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al registrar pagos: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
