<?php
/**
 * Endpoint: action=obtener_socio_comprobante&id={id_alumno}
 * Devuelve la ficha del alumno lista para el comprobante.
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

$id = $_GET['id'] ?? null;
if (!$id) {
    echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado']);
    exit;
}

try {
    // Traemos alumno + categoria (monto)
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
            c.nombre_categoria,
            c.monto      AS precio_categoria
        FROM alumnos a
        LEFT JOIN categoria c ON c.id_categoria = a.id_categoria
        WHERE a.id_alumno = ?
        LIMIT 1
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        echo json_encode(['exito' => false, 'mensaje' => 'Alumno no encontrado']);
        exit;
    }

    // Normalizaciones (por si some front espera claves genéricas)
    $socio = [
        'id_alumno'        => $row['id_alumno'],
        'id'               => $row['id_alumno'],         // alias de cortesía
        'apellido'         => $row['apellido'] ?? '',
        'nombre'           => $row['nombre'] ?? '',
        'num_documento'    => $row['num_documento'] ?? '',
        'dni'              => $row['num_documento'] ?? '',// alias de cortesía
        'domicilio'        => $row['domicilio'] ?? '',
        'localidad'        => $row['localidad'] ?? '',
        'telefono'         => $row['telefono'] ?? '',
        'id_division'      => $row['id_division'] ?? null,
        'id_categoria'     => $row['id_categoria'] ?? null,
        'nombre_categoria' => $row['nombre_categoria'] ?? '',
        'precio_categoria' => (string)($row['precio_categoria'] ?? '0'),
        // para fallback en front:
        'monto'            => (string)($row['precio_categoria'] ?? '0')
    ];

    echo json_encode(['exito' => true, 'socio' => $socio], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error de servidor: ' . $e->getMessage()]);
}
