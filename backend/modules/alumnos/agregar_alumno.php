<?php
// backend/modules/alumnos/agregar_alumno.php
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
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);

    if (!$data || !is_array($data)) {
        echo json_encode(['exito' => false, 'mensaje' => 'Datos no válidos.']);
        exit;
    }

    // Helpers
    $toUpper = function ($txt, $max = null) {
        if (!isset($txt) || trim((string)$txt) === '') return null;
        $val = mb_strtoupper(trim((string)$txt), 'UTF-8');
        if ($max !== null && mb_strlen($val, 'UTF-8') > $max) {
            $val = mb_substr($val, 0, $max, 'UTF-8');
        }
        return $val;
    };

    $errors = [];

    // ===== Campos =====
    $apellido          = $toUpper($data['apellido'] ?? '', 100); // NOT NULL
    $nombre            = $toUpper($data['nombre']   ?? '', 100); // NULL permitido
    $id_tipo_documento = isset($data['id_tipo_documento']) && $data['id_tipo_documento'] !== '' ? (int)$data['id_tipo_documento'] : null; // opcional
    $num_documento     = isset($data['num_documento']) ? trim((string)$data['num_documento']) : ''; // NOT NULL, UNIQUE
    $id_sexo           = isset($data['id_sexo']) && $data['id_sexo'] !== '' ? (int)$data['id_sexo'] : null; // opcional
    $domicilio         = $toUpper($data['domicilio'] ?? '', 150);
    $localidad         = $toUpper($data['localidad'] ?? '', 100);
    $telefono          = isset($data['telefono']) ? trim((string)$data['telefono']) : '';
    $id_anio           = isset($data['id_año']) ? (int)$data['id_año'] : null; // JSON llega con "id_año"
    $id_division       = isset($data['id_division']) ? (int)$data['id_division'] : null;
    $id_categoria      = isset($data['id_categoria']) && $data['id_categoria'] !== '' ? (int)$data['id_categoria'] : 1;

    // ✅ NUEVO: Observaciones (texto libre, opcional, sin transformar)
    $observaciones     = isset($data['observaciones']) ? (string)$data['observaciones'] : null;
    if ($observaciones !== null) {
        $observaciones = trim($observaciones);
        if ($observaciones === '') $observaciones = null; // guardar NULL si viene vacío
        // No aplicamos restricciones de caracteres (texto libre)
        // Si quisieras limitar tamaño en servidor: $observaciones = mb_substr($observaciones, 0, 65535, 'UTF-8');
    }

    // ===== Validaciones =====
    if (!$apellido || !preg_match('/^[A-ZÑÁÉÍÓÚ\s.]+$/u', $apellido)) {
        $errors['apellido'] = 'Apellido es obligatorio. Solo letras, espacios y puntos.';
    }
    if ($nombre && !preg_match('/^[A-ZÑÁÉÍÓÚ\s.]+$/u', $nombre)) {
        $errors['nombre'] = 'Nombre con formato inválido.';
    }
    if ($num_documento === '' || !preg_match('/^[0-9]+$/', $num_documento)) {
        $errors['num_documento'] = 'Documento obligatorio y numérico.';
    } elseif (strlen($num_documento) > 20) {
        $errors['num_documento'] = 'Documento máximo 20 caracteres.';
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
    if ($id_tipo_documento !== null && !is_int($id_tipo_documento)) {
        $errors['id_tipo_documento'] = 'Tipo de documento inválido.';
    }
    if ($id_sexo !== null && !is_int($id_sexo)) {
        $errors['id_sexo'] = 'Sexo inválido.';
    }

    if (!empty($errors)) {
        echo json_encode(['exito' => false, 'errores' => $errors], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Normalizar vacíos a null
    $nombre    = ($nombre && trim($nombre) !== '') ? $nombre : null;
    $domicilio = $domicilio ?: null;
    $localidad = $localidad ?: null;
    $telefono  = $telefono  ?: null;

    // ===== INSERT (incluye observaciones) =====
    // NOTA: 'activo' y 'ingreso' tienen DEFAULT en la tabla.
    $sql = "INSERT INTO `alumnos`
            (`apellido`, `nombre`, `id_tipo_documento`, `num_documento`, `id_sexo`,
             `domicilio`, `localidad`, `telefono`, `id_año`, `id_division`, `id_categoria`,
             `observaciones`)
            VALUES
            (:apellido, :nombre, :id_tipo_documento, :num_documento, :id_sexo,
             :domicilio, :localidad, :telefono, :id_anio, :id_division, :id_categoria,
             :observaciones)";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':apellido'          => $apellido,
        ':nombre'            => $nombre,
        ':id_tipo_documento' => $id_tipo_documento,  // null permitido
        ':num_documento'     => $num_documento,
        ':id_sexo'           => $id_sexo,            // null permitido
        ':domicilio'         => $domicilio,
        ':localidad'         => $localidad,
        ':telefono'          => $telefono,
        ':id_anio'           => $id_anio,            // placeholder ascii
        ':id_division'       => $id_division,
        ':id_categoria'      => $id_categoria,
        ':observaciones'     => $observaciones       // ✅ nuevo campo
    ]);

    echo json_encode(['exito' => true, 'mensaje' => '✅ Alumno registrado correctamente.'], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    if ($e->getCode() === '23000' && strpos($e->getMessage(), '1062') !== false) {
        echo json_encode([
            'exito' => false,
            'mensaje' => 'El Documento ya existe en el sistema.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => '❌ Error: ' . $e->getMessage()]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => '❌ Error: ' . $e->getMessage()]);
}
