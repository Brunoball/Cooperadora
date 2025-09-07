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

    $idAlumno  = isset($payload['id_alumno']) ? (int)$payload['id_alumno'] : 0;
    $periodos  = isset($payload['periodos']) && is_array($payload['periodos']) ? $payload['periodos'] : [];
    $condonar  = !empty($payload['condonar']);
    $anioInput = isset($payload['anio']) ? (int)$payload['anio'] : (int)date('Y');

    if ($idAlumno <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID de alumno inválido']);
        exit;
    }
    if (empty($periodos)) {
        echo json_encode(['exito' => false, 'mensaje' => 'No se enviaron meses a registrar']);
        exit;
    }
    if ($anioInput < 2000 || $anioInput > 2100) {
        $anioInput = (int)date('Y');
    }

    // Estado
    $estadoRegistrar = $condonar ? 'condonado' : 'pagado';

    // FECHA DE PAGO:
    // - día y mes actuales
    // - año = $anioInput (el seleccionado) para que quede en ese año
    $hoy = new DateTime(); // hoy local del servidor
    $diaActual  = (int)$hoy->format('d');
    $mesActual  = (int)$hoy->format('m');
    $fechaPagoStr = sprintf('%04d-%02d-%02d', $anioInput, $mesActual, $diaActual);

    $pdo->beginTransaction();

    // Meses/estados ya registrados en ESE AÑO (evitar duplicados)
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

    $stIns = $pdo->prepare("
        INSERT INTO cooperadora.pagos (id_alumno, id_mes, fecha_pago, estado)
        VALUES (:id_alumno, :id_mes, :fecha_pago, :estado)
    ");

    $insertados = 0;
    $yaRegistrados = [];

    foreach ($periodos as $mesId) {
        $mes = (int)$mesId;
        if ($mes < 1 || $mes > 12) {
            // ajustar si manejás otros IDs especiales
            continue;
        }

        if (array_key_exists($mes, $yaPorMes)) {
            // ya hay registro para ese mes en el año elegido
            $yaRegistrados[] = [
                'periodo' => $mes,
                'estado'  => $yaPorMes[$mes],
            ];
            continue;
        }

        $stIns->execute([
            ':id_alumno'  => $idAlumno,
            ':id_mes'     => $mes,
            ':fecha_pago' => $fechaPagoStr,
            ':estado'     => $estadoRegistrar,
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
    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(200);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al registrar pagos: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
