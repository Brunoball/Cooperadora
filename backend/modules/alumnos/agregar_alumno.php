<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config/db.php';

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);

    if (!$data || !is_array($data)) {
        echo json_encode(['exito' => false, 'mensaje' => 'Datos no válidos.']);
        exit;
    }

    // Helpers
    $toUpper = function ($txt, $max = null) {
        if (!isset($txt) || trim($txt) === '') return null;
        $val = mb_strtoupper(trim($txt), 'UTF-8');
        if ($max !== null && mb_strlen($val, 'UTF-8') > $max) {
            $val = mb_substr($val, 0, $max, 'UTF-8');
        }
        return $val;
    };

    $errors = [];

    // Campos (ojo: el JSON trae "id_año" pero usamos variable ascii $id_anio)
    $apellido_nombre = $toUpper($data['apellido_nombre'] ?? '', 100);
    $dni             = isset($data['dni']) ? trim((string)$data['dni']) : '';
    $domicilio       = $toUpper($data['domicilio'] ?? '', 150);
    $localidad       = $toUpper($data['localidad'] ?? '', 100);
    $telefono        = isset($data['telefono']) ? trim((string)$data['telefono']) : '';
    $id_anio         = isset($data['id_año']) ? (int)$data['id_año'] : null;       // <- lee id_año
    $id_division     = isset($data['id_division']) ? (int)$data['id_division'] : null;
    $id_categoria    = isset($data['id_categoria']) && $data['id_categoria'] !== '' ? (int)$data['id_categoria'] : 1;

    // Validaciones
    if (!$apellido_nombre || !preg_match('/^[A-ZÑÁÉÍÓÚ\s.]+$/u', $apellido_nombre)) {
        $errors['apellido_nombre'] = 'Apellido y nombre es obligatorio. Solo letras, espacios y puntos.';
    }

    if ($dni === '' || !preg_match('/^[0-9]+$/', $dni)) {
        $errors['dni'] = 'DNI obligatorio y numérico.';
    } elseif (strlen($dni) > 15) {
        $errors['dni'] = 'DNI máximo 15 caracteres.';
    }

    if ($domicilio && !preg_match('/^[A-ZÑÁÉÍÓÚ0-9\s.,-]+$/u', $domicilio)) {
        $errors['domicilio'] = 'Domicilio con caracteres inválidos.';
    }

    if ($localidad && !preg_match('/^[A-ZÑÁÉÍÓÚ0-9\s.,-]+$/u', $localidad)) {
        $errors['localidad'] = 'Localidad con caracteres inválidos.';
    }

    if ($telefono && (!preg_match('/^[0-9+\-\s]+$/', $telefono) || strlen($telefono) > 20)) {
        $errors['telefono'] = 'Teléfono inválido (números, espacios y guiones, máx 20).';
    }

    if (!$id_anio || !is_int($id_anio)) {
        $errors['id_año'] = 'Año obligatorio.';
    }

    if (!$id_division || !is_int($id_division)) {
        $errors['id_division'] = 'División obligatoria.';
    }

    if (!$id_categoria || !is_int($id_categoria)) {
        $errors['id_categoria'] = 'Categoría obligatoria.';
    }

    if (!empty($errors)) {
        echo json_encode(['exito' => false, 'errores' => $errors], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Normalizar vacíos a null
    $domicilio = $domicilio ?: null;
    $localidad = $localidad ?: null;
    $telefono  = $telefono  ?: null;

    // INSERT (columnas con ñ entre backticks; placeholders ascii)
    $sql = "INSERT INTO `alumnos`
            (`apellido_nombre`, `dni`, `domicilio`, `localidad`, `telefono`, `id_año`, `id_division`, `id_categoria`)
            VALUES
            (:apellido_nombre, :dni, :domicilio, :localidad, :telefono, :id_anio, :id_division, :id_categoria)";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':apellido_nombre' => $apellido_nombre,
        ':dni'             => $dni,
        ':domicilio'       => $domicilio,
        ':localidad'       => $localidad,
        ':telefono'        => $telefono,
        ':id_anio'         => $id_anio,       // <- placeholder sin ñ
        ':id_division'     => $id_division,
        ':id_categoria'    => $id_categoria
    ]);

    echo json_encode(['exito' => true, 'mensaje' => '✅ Alumno registrado correctamente.'], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => '❌ Error: ' . $e->getMessage()]);
}
