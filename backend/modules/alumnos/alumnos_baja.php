<?php
// backend/modules/alumnos/alumnos_baja.php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/db.php'; // Debe definir $pdo (PDO)

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Filtros opcionales (?q=texto | ?id=123)
    $q  = isset($_GET['q'])  ? trim((string)$_GET['q']) : '';
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    /**
     * Igual que en el archivo de activos:
     * - Si usás `apellido` y `nombre` separados, reemplazá a.apellido_nombre por CONCAT_WS(' ', a.apellido, a.nombre)
     */
    $sql = "
        SELECT
            a.id_alumno,
            a.apellido_nombre AS nombre_apellido,
            a.apellido_nombre AS apellido_nombre,  -- por compatibilidad con tu front
            a.domicilio,
            a.ingreso,
            a.motivo
        FROM alumnos a
        /**WHERE**/
        ORDER BY a.id_alumno ASC
    ";

    $where  = ["a.activo = 0"];  // SOLO DADOS DE BAJA
    $params = [];

    if ($id > 0) {
        $where[]        = "a.id_alumno = :id";
        $params[':id']  = $id;
    } elseif ($q !== '') {
        $where[]        = "a.apellido_nombre LIKE :q";
        $params[':q']   = "%{$q}%";
    }

    if (!empty($where)) {
        $sql = str_replace('/**WHERE**/', 'WHERE ' . implode(' AND ', $where), $sql);
    } else {
        $sql = str_replace('/**WHERE**/', '', $sql);
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $alumnos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'exito'   => true,
        'alumnos' => $alumnos
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al obtener alumnos dados de baja: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
