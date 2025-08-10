<?php
// modules/pagos/registrar_pago.php
require_once __DIR__ . '/../../config/db.php';
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

try {
    if ($pdo instanceof PDO) {
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    } else {
        throw new RuntimeException('Conexión PDO no disponible');
    }

    $payload = json_decode(file_get_contents('php://input'), true);
    $idAlumno = isset($payload['id_alumno']) ? (int)$payload['id_alumno'] : 0;
    $periodos = isset($payload['periodos']) && is_array($payload['periodos']) ? $payload['periodos'] : [];

    if ($idAlumno <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID de alumno inválido']);
        exit;
    }
    if (empty($periodos)) {
        echo json_encode(['exito' => false, 'mensaje' => 'No se enviaron meses a registrar']);
        exit;
    }

    // (Opcional) Evitar duplicados lógicos: asegurá un índice único (id_alumno, id_mes) en DB.
    // Mientras tanto, validamos en app.
    $pdo->beginTransaction();

    // Meses ya pagados (evitar duplicar)
    $stmtExist = $pdo->prepare("SELECT id_mes FROM pagos WHERE id_alumno = :id");
    $stmtExist->execute([':id' => $idAlumno]);
    $yaPagados = array_map('intval', $stmtExist->fetchAll(PDO::FETCH_COLUMN));
    $yaPagadosSet = array_flip($yaPagados);

    $stmtIns = $pdo->prepare("
        INSERT INTO pagos (id_alumno, id_mes, fecha_pago)
        VALUES (:id_alumno, :id_mes, CURDATE())
    ");

    $insertados = 0;
    foreach ($periodos as $mesId) {
        $mes = (int)$mesId;
        if ($mes < 1 || $mes > 12) continue;          // validación básica
        if (isset($yaPagadosSet[$mes])) continue;     // evitar duplicado

        $stmtIns->execute([
            ':id_alumno' => $idAlumno,
            ':id_mes'    => $mes,
        ]);
        $insertados++;
    }

    $pdo->commit();

    if ($insertados > 0) {
        echo json_encode(['exito' => true, 'insertados' => $insertados]);
    } else {
        echo json_encode(['exito' => false, 'mensaje' => 'No se insertaron pagos (posibles duplicados)']);
    }
} catch (Throwable $e) {
    if ($pdo->inTransaction()) { $pdo->rollBack(); }
    echo json_encode(['exito' => false, 'mensaje' => 'Error al registrar pagos']);
}
