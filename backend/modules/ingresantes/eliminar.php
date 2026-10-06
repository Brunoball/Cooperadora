<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido.'], JSON_UNESCAPED_UNICODE);
    exit;
}

require_once __DIR__ . '/../../config/db.php';

try {
    $data = json_decode((string)file_get_contents('php://input'), true);
    $id = is_array($data) ? (int)($data['id_ingresante'] ?? 0) : 0;

    if ($id <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID no válido.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $stmt = $pdo->prepare("DELETE FROM ingresantes WHERE id_ingresante = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() < 1) {
        echo json_encode(['exito' => false, 'mensaje' => 'El ingresante ya no existe.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['exito' => true, 'mensaje' => 'Ingresante eliminado correctamente.'], JSON_UNESCAPED_UNICODE);
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error al eliminar el ingresante: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
