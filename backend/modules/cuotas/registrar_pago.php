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

    // ===== Payload base =====
    $idAlumno   = isset($payload['id_alumno']) ? (int)$payload['id_alumno'] : 0;
    $periodos   = isset($payload['periodos']) && is_array($payload['periodos']) ? $payload['periodos'] : [];
    $condonar   = !empty($payload['condonar']);
    $anioInput  = isset($payload['anio']) ? (int)$payload['anio'] : (int)date('Y');

    // Compat: monto_libre / monto_unitario
    $montoLibre = isset($payload['monto_libre']) ? (int)$payload['monto_libre'] : 0;
    $montoUI    = isset($payload['monto_unitario']) ? (int)$payload['monto_unitario'] : null;

    // Montos por período (incluye 13 y 14)
    $montosPorPeriodo = [];
    if (isset($payload['montos_por_periodo']) && is_array($payload['montos_por_periodo'])) {
        foreach ($payload['montos_por_periodo'] as $k => $v) {
            $kk = (int)$k;
            $vv = (int)$v;
            $montosPorPeriodo[$kk] = $vv;
        }
    }

    // ===== NUEVO: aplicar a grupo familiar =====
    $aplicarFamilia = !empty($payload['aplicar_a_familia']);
    $idsFamilia     = [];
    if ($aplicarFamilia && isset($payload['ids_familia']) && is_array($payload['ids_familia'])) {
        foreach ($payload['ids_familia'] as $idf) {
            $idClean = (int)$idf;
            if ($idClean > 0 && $idClean !== $idAlumno) {
                $idsFamilia[$idClean] = true; // usar como set
            }
        }
    }
    $idsFamilia = array_keys($idsFamilia);

    // ===== Validaciones mínimas =====
    if ($idAlumno <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID de alumno inválido'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (empty($periodos)) {
        echo json_encode(['exito' => false, 'mensaje' => 'No se enviaron períodos a registrar'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($anioInput < 2000 || $anioInput > 2100) {
        $anioInput = (int)date('Y');
    }

    $estadoRegistrar = $condonar ? 'condonado' : 'pagado';

    // FECHA DE PAGO: mismo día/mes de hoy, año = $anioInput (seleccionado)
    $hoy = new DateTime();
    $diaActual     = (int)$hoy->format('d');
    $mesActual     = (int)$hoy->format('m');
    $fechaPagoStr  = sprintf('%04d-%02d-%02d', $anioInput, $mesActual, $diaActual);

    // Resolver monto por período
    $resolverMonto = function (bool $condonar, ?int $montoUI, int $montoLibre, array $montos, int $periodo): int {
        if ($condonar) return 0;
        if (isset($montos[$periodo]) && is_int($montos[$periodo]) && $montos[$periodo] >= 0) {
            return (int)$montos[$periodo];
        }
        if (is_int($montoUI) && $montoUI > 0) return $montoUI;
        if ($montoLibre > 0) return $montoLibre;
        return 0;
    };

    // Períodos válidos: 1..12 (meses), 13 (Contado Anual), 14 (Matrícula)
    $validos = array_fill(1, 14, true);

    // ===== Preparar consultas =====
    $stExist = $pdo->prepare("
        SELECT id_mes, estado
          FROM pagos
         WHERE id_alumno = :id_alumno
           AND YEAR(fecha_pago) = :anio
    ");

    $stIns = $pdo->prepare("
        INSERT INTO pagos (id_alumno, id_mes, fecha_pago, estado, monto_pago)
        VALUES (:id_alumno, :id_mes, :fecha_pago, :estado, :monto_pago)
    ");

    // ===== Armar lista final de alumnos a procesar =====
    $alumnosObjetivo = [$idAlumno];
    if ($aplicarFamilia && !empty($idsFamilia)) {
        // Evitar duplicados y excluir el alumno principal por si vino en el array
        $set = [];
        foreach ($alumnosObjetivo as $idp) $set[$idp] = true;
        foreach ($idsFamilia as $idf) $set[(int)$idf] = true;
        $alumnosObjetivo = array_map('intval', array_keys($set));
    }

    $totalInsertados = 0;
    $detallePorAlumno = []; // para respuesta

    $pdo->beginTransaction();

    foreach ($alumnosObjetivo as $idA) {
        if ($idA <= 0) continue;

        // Consultar existentes para ese alumno y año
        $stExist->execute([
            ':id_alumno' => $idA,
            ':anio'      => $anioInput,
        ]);
        $existentes = $stExist->fetchAll(PDO::FETCH_ASSOC);

        $yaPorMes = []; // [id_mes] => estado
        foreach ($existentes as $row) {
            $yaPorMes[(int)$row['id_mes']] = (string)$row['estado'];
        }

        $insertadosAlumno = 0;
        $yaRegistradosAlumno = [];

        foreach ($periodos as $mesId) {
            $mes = (int)$mesId;

            if (!isset($validos[$mes])) {
                // Ignorar cualquier id_mes que no sea 1..14
                continue;
            }

            if (array_key_exists($mes, $yaPorMes)) {
                $yaRegistradosAlumno[] = [
                    'periodo' => $mes,
                    'estado'  => $yaPorMes[$mes],
                ];
                continue;
            }

            $montoPago = $resolverMonto($condonar, $montoUI, $montoLibre, $montosPorPeriodo, $mes);

            $stIns->execute([
                ':id_alumno'  => $idA,
                ':id_mes'     => $mes,
                ':fecha_pago' => $fechaPagoStr,
                ':estado'     => $estadoRegistrar,
                ':monto_pago' => $montoPago,
            ]);

            $insertadosAlumno++;
            $totalInsertados++;
        }

        $detallePorAlumno[] = [
            'id_alumno'     => $idA,
            'insertados'    => $insertadosAlumno,
            'ya_registrados'=> $yaRegistradosAlumno,
        ];
    }

    $pdo->commit();

    if ($totalInsertados > 0) {
        echo json_encode([
            'exito'                 => true,
            'insertados_total'      => $totalInsertados,
            'familia_aplicada'      => $aplicarFamilia && count($alumnosObjetivo) > 1,
            'alumnos_procesados'    => count($alumnosObjetivo),
            'detalle_por_alumno'    => $detallePorAlumno,
        ], JSON_UNESCAPED_UNICODE);
    } else {
        // Nada para insertar (ya estaban todos)
        echo json_encode([
            'exito'                 => false,
            'mensaje'               => 'No se insertaron registros (todos ya estaban cargados para ese año).',
            'familia_aplicada'      => $aplicarFamilia && count($alumnosObjetivo) > 1,
            'alumnos_procesados'    => count($alumnosObjetivo),
            'detalle_por_alumno'    => $detallePorAlumno,
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
