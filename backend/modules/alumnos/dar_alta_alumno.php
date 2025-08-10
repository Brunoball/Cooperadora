<?php
// backend/modules/alumnos/dar_alta_alumno.php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/db.php'; // Debe definir $pdo (PDO)

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
        exit;
    }

    $body = json_decode(file_get_contents('php://input'), true);
    $id_alumno = isset($body['id_alumno']) ? (int)$body['id_alumno'] : 0;

    if ($id_alumno <= 0) {
        http_response_code(400);
        echo json_encode(['exito' => false, 'mensaje' => 'ID de alumno inválido']);
        exit;
    }

    // Reactivar alumno y limpiar el motivo de la baja
    $stmt = $pdo->prepare("
        UPDATE alumnos
        SET activo = 1,
            motivo = NULL
        WHERE id_alumno = :id
        LIMIT 1
    ");
    $stmt->execute([':id' => $id_alumno]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['exito' => false, 'mensaje' => 'Alumno no encontrado']);
        exit;
    }

    echo json_encode(['exito' => true], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al dar de alta al alumno: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
