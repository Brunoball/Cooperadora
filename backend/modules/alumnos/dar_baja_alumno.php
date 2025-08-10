<?php
require_once __DIR__ . '/../../config/db.php'; // Debe exponer $pdo (PDO)
header('Content-Type: application/json');

// Cuerpo JSON
$payload = json_decode(file_get_contents('php://input'), true);
$id_alumno = isset($payload['id_alumno']) ? (int)$payload['id_alumno'] : 0;
$motivo    = isset($payload['motivo']) ? trim($payload['motivo']) : '';

if ($id_alumno <= 0) {
    echo json_encode(['exito' => false, 'mensaje' => 'ID de alumno inválido']);
    exit;
}

if ($motivo === '') {
    echo json_encode(['exito' => false, 'mensaje' => 'El motivo es obligatorio']);
    exit;
}

// Convertimos el motivo a mayúsculas (manteniendo tildes y ñ correctamente)
$motivo = mb_strtoupper($motivo, 'UTF-8');

try {
    // Actualiza: activo=0, motivo=<texto>, ingreso=fecha actual
    $sql = "UPDATE alumnos
            SET activo = 0,
                motivo = :motivo,
                ingreso = CURDATE()
            WHERE id_alumno = :id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':motivo' => $motivo,
        ':id'     => $id_alumno
    ]);

    // Devolvemos también la fecha aplicada por comodidad del frontend
    $fecha = (new DateTime('now'))->format('Y-m-d');
    echo json_encode([
        'exito'   => true,
        'mensaje' => 'Alumno dado de baja correctamente',
        'fecha'   => $fecha
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al dar de baja: ' . $e->getMessage()
    ]);
}
