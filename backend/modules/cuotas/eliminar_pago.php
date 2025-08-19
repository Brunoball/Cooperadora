<?php
// backend/modules/cuotas/eliminar_pago.php

// CORS (ajustá el origin si hace falta)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header("Vary: Origin");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

// Método
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
    exit;
}

// DB
require_once __DIR__ . '/../../config/db.php'; // Debe definir $pdo (PDO) o $conn (mysqli)

// Leer JSON o form-data
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data) || empty($data)) {
    $data = $_POST;
}

// Normalizar nombres de campos a la estructura real de la tabla:
// pagos(id_pago, id_alumno, id_mes, fecha_pago)
$id_alumno = null;
$id_mes    = null;

// Aceptar variantes por compatibilidad
if (isset($data['id_alumno'])) $id_alumno = (int)$data['id_alumno'];
if (isset($data['id_socio']) && !$id_alumno) $id_alumno = (int)$data['id_socio']; // tolerancia

if (isset($data['id_mes'])) $id_mes = (int)$data['id_mes'];
if (isset($data['id_periodo']) && !$id_mes) $id_mes = (int)$data['id_periodo'];   // tolerancia
if (isset($data['periodo']) && !$id_mes) $id_mes = (int)$data['periodo'];         // tolerancia

if ($id_alumno <= 0 || $id_mes <= 0) {
    http_response_code(400);
    echo json_encode(['exito' => false, 'mensaje' => 'Faltan datos']);
    exit;
}

try {
    // Usar PDO si está disponible
    if (isset($pdo) && $pdo instanceof PDO) {
        $stmt = $pdo->prepare("DELETE FROM pagos WHERE id_alumno = :id_alumno AND id_mes = :id_mes LIMIT 1");
        $ok = $stmt->execute([
            ':id_alumno' => $id_alumno,
            ':id_mes'    => $id_mes,
        ]);

        if (!$ok || $stmt->rowCount() === 0) {
            echo json_encode(['exito' => false, 'mensaje' => 'No se encontró un pago para eliminar']);
            exit;
        }

        echo json_encode(['exito' => true, 'mensaje' => 'Pago eliminado correctamente']);
        exit;
    }

    // Fallback a mysqli
    if (isset($conn) && $conn instanceof mysqli) {
        $sql = "DELETE FROM pagos WHERE id_alumno = ? AND id_mes = ? LIMIT 1";
        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            http_response_code(500);
            echo json_encode(['exito' => false, 'mensaje' => 'Error de preparación']);
            exit;
        }
        $stmt->bind_param('ii', $id_alumno, $id_mes);
        $stmt->execute();

        if ($stmt->affected_rows <= 0) {
            echo json_encode(['exito' => false, 'mensaje' => 'No se encontró un pago para eliminar']);
            $stmt->close();
            exit;
        }

        $stmt->close();
        echo json_encode(['exito' => true, 'mensaje' => 'Pago eliminado correctamente']);
        exit;
    }

    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'Conexión a BD no disponible']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'Error interno', 'detalle' => $e->getMessage()]);
}
