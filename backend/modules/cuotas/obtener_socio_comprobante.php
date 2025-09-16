<?php
/**
 * Endpoint: action=obtener_socio_comprobante&id={id_alumno}
 * Devuelve la ficha del alumno lista para el comprobante,
 * tomando el MONTO desde categoria_monto (monto_mensual).
 */
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($id <= 0) {
    echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado o inválido']);
    exit;
}

try {
    // Traemos alumno + su categoria_monto (si la tiene)
    $sql = "
        SELECT
            a.id_alumno,
            a.apellido,
            a.nombre,
            a.num_documento,
            a.domicilio,
            a.localidad,
            a.telefono,
            a.id_division,
            a.id_categoria,
            a.id_cat_monto,

            cm.nombre_categoria   AS cm_nombre_categoria,
            cm.monto_mensual      AS cm_monto_mensual,
            cm.monto_anual        AS cm_monto_anual
        FROM alumnos a
        LEFT JOIN categoria_monto cm
               ON cm.id_cat_monto = a.id_cat_monto
        WHERE a.id_alumno = :id
        LIMIT 1
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        echo json_encode(['exito' => false, 'mensaje' => 'Alumno no encontrado']);
        exit;
    }

    // Si el alumno tiene id_cat_monto válido, usamos su monto_mensual y nombre
    $tieneCatMonto   = !empty($row['id_cat_monto']) && $row['cm_monto_mensual'] !== null;
    $categoriaNombre = $tieneCatMonto ? (string)($row['cm_nombre_categoria'] ?? '') : '';
    $montoMensual    = $tieneCatMonto ? (int)$row['cm_monto_mensual'] : 0;

    $socio = [
        'id_alumno'        => (int)$row['id_alumno'],
        'id'               => (int)$row['id_alumno'], // alias
        'apellido'         => (string)($row['apellido'] ?? ''),
        'nombre'           => (string)($row['nombre'] ?? ''),
        'apellido_nombre'  => trim(($row['apellido'] ?? '') . ' ' . ($row['nombre'] ?? '')),
        'num_documento'    => (string)($row['num_documento'] ?? ''),
        'dni'              => (string)($row['num_documento'] ?? ''), // alias
        'domicilio'        => (string)($row['domicilio'] ?? ''),
        'localidad'        => (string)($row['localidad'] ?? ''),
        'telefono'         => (string)($row['telefono'] ?? ''),
        'id_division'      => isset($row['id_division'])  ? (int)$row['id_division']  : null,
        'id_categoria'     => isset($row['id_categoria']) ? (int)$row['id_categoria'] : null,
        'id_cat_monto'     => isset($row['id_cat_monto']) ? (int)$row['id_cat_monto'] : null,

        // Datos efectivos para el comprobante
        'nombre_categoria' => $categoriaNombre,
        'monto_mensual'    => $montoMensual,   // <— ESTE es el que debe imprimirse
        'precio_categoria' => $montoMensual,   // alias por compatibilidad
        'fuente_categoria' => $tieneCatMonto ? 'categoria_monto' : 'sin_categoria_monto'
    ];

    echo json_encode(['exito' => true, 'socio' => $socio], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error de servidor: ' . $e->getMessage()]);
}
