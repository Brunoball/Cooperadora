<?php
// === CORS Headers ===
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Preflight (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// === Conexión a DB ===
require_once(__DIR__ . '/../../config/db.php');

// === Leer JSON ===
$data = json_decode(file_get_contents("php://input"), true);
$id_socio = $data['id_socio'] ?? null;
$id_periodo = $data['id_periodo'] ?? null;

if (!$id_socio || !$id_periodo) {
    echo json_encode(['exito' => false, 'mensaje' => 'Faltan datos']);
    exit;
}

try {
    $stmt = $pdo->prepare("DELETE FROM pagos WHERE id_socio = :id_socio AND id_periodo = :id_periodo");
    $stmt->execute([
        ':id_socio' => $id_socio,
        ':id_periodo' => $id_periodo
    ]);

    if ($stmt->rowCount() > 0) {
        echo json_encode(['exito' => true, 'mensaje' => 'Pago eliminado correctamente']);
    } else {
        echo json_encode(['exito' => false, 'mensaje' => 'No se encontró un pago para eliminar']);
    }
} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error en la base de datos: ' . $e->getMessage()]);
}
