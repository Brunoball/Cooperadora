<?php
// modules/alumnos/eliminar_alumno.php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
        exit;
    }

    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true) ?: [];
    $id = $data['id_alumno'] ?? null;

    if (!$id) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado']);
        exit;
    }

    $st = $pdo->prepare("DELETE FROM alumnos WHERE id_alumno = ?");
    $st->execute([$id]);

    echo json_encode(['exito' => true, 'mensaje' => 'Alumno eliminado correctamente']);
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()]);
}
