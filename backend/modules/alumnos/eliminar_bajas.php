<?php
// modules/alumnos/eliminar_bajas.php
require_once __DIR__ . '/../../config/db.php'; // Debe exponer $pdo (PDO)
header('Content-Type: application/json; charset=utf-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
        exit;
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?: [];

    // Puede venir un único id o un array de ids
    $id  = isset($data['id_alumno']) ? (int)$data['id_alumno'] : 0;
    $ids = isset($data['ids']) && is_array($data['ids']) ? $data['ids'] : [];

    // Normalizo
    if ($id > 0 && empty($ids)) {
        $ids = [$id];
    }
    $ids = array_values(array_unique(array_map('intval', $ids)));
    $ids = array_filter($ids, fn($v) => $v > 0);

    if (empty($ids)) {
        echo json_encode(['exito' => false, 'mensaje' => 'Debe enviar id_alumno o ids válidos']);
        exit;
    }

    // IMPORTANTE: este endpoint SOLO elimina inactivos
    // Evita borrar por error registros activos desde la pantalla de bajas
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $sql = "DELETE FROM alumnos WHERE activo = 0 AND id_alumno IN ($placeholders)";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($ids);

    $eliminados = $stmt->rowCount();

    if ($eliminados > 0) {
        echo json_encode([
            'exito' => true,
            'eliminados' => $eliminados,
            'mensaje' => "Se eliminaron definitivamente {$eliminados} registro(s) inactivo(s)."
        ]);
    } else {
        echo json_encode([
            'exito' => false,
            'mensaje' => 'No se eliminaron registros. Verifique que los IDs existan y estén inactivos.'
        ]);
    }

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error al eliminar definitivamente.',
        'detalle' => $e->getMessage()
    ]);
}
