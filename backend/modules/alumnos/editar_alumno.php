<?php
// modules/alumnos/editar_alumno.php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

function aMayus($v) {
    return (isset($v) && $v !== '') ? mb_strtoupper(trim($v), 'UTF-8') : null;
}

/**
 * Normaliza fechas a 'Y-m-d'. Acepta:
 *  - 'Y-m-d'
 *  - 'd/m/Y'
 * Devuelve string normalizado o null si inválida.
 */
function normalizarFecha($s) {
    $s = trim((string)$s);
    if ($s === '') return null;

    // YYYY-MM-DD
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
        $dt = DateTime::createFromFormat('Y-m-d', $s);
        $err = DateTime::getLastErrors();
        if ($dt && empty($err['warning_count']) && empty($err['error_count'])) {
            return $dt->format('Y-m-d');
        }
    }

    // DD/MM/YYYY
    if (preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $s)) {
        $dt = DateTime::createFromFormat('d/m/Y', $s);
        $err = DateTime::getLastErrors();
        if ($dt && empty($err['warning_count']) && empty($err['error_count'])) {
            return $dt->format('Y-m-d');
        }
    }

    return null;
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $id = $_GET['id'] ?? null;
        if (!$id) {
            echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado']);
            exit;
        }

        // NOTA: alias id_año -> id_anio, incluir ingreso
        $sql = "SELECT 
                    id_alumno,
                    apellido_nombre,
                    dni,
                    domicilio,
                    localidad,
                    telefono,
                    `id_año` AS id_anio,
                    id_division,
                    id_categoria,
                    ingreso
                FROM alumnos
                WHERE id_alumno = ?";
        $st = $pdo->prepare($sql);
        $st->execute([$id]);
        $alumno = $st->fetch(PDO::FETCH_ASSOC);

        if ($alumno) {
            echo json_encode(['exito' => true, 'alumno' => $alumno]);
        } else {
            echo json_encode(['exito' => false, 'mensaje' => 'Alumno no encontrado']);
        }
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents("php://input");
        $data = json_decode($raw, true) ?: [];

        $id = $data['id_alumno'] ?? null;
        if (!$id) {
            echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado']);
            exit;
        }

        // Campos recibidos desde el frontend
        $campos = [
            'apellido_nombre', 'dni', 'domicilio', 'localidad', 'telefono',
            'id_anio', 'id_division', 'id_categoria'
        ];

        $set = [];
        $val = [];

        foreach ($campos as $c) {
            // si no viene la clave, no actualizar
            if (!array_key_exists($c, $data)) continue;

            $v = $data[$c];

            // Vacíos => null
            if ($v === '') $v = null;

            // Uppercase para texto
            if (in_array($c, ['apellido_nombre', 'domicilio', 'localidad'])) {
                $v = aMayus($v);
            }

            // Mapeo del nombre lógico a la columna real (con ñ)
            if ($c === 'id_anio') {
                $set[] = "`id_año` = ?";
            } else {
                $set[] = "$c = ?";
            }

            $val[] = $v;
        }

        // === NUEVO: ingreso (opcional). Si viene, validar/normalizar y actualizar ===
        if (array_key_exists('ingreso', $data)) {
            $ingRaw = $data['ingreso'];
            if ($ingRaw === '' || $ingRaw === null) {
                // No permitir vaciar porque la columna es NOT NULL; devolvemos error claro
                http_response_code(422);
                echo json_encode(['exito' => false, 'mensaje' => 'La fecha de ingreso no puede ser vacía.']);
                exit;
            }
            $ingNorm = normalizarFecha($ingRaw);
            if ($ingNorm === null) {
                http_response_code(422);
                echo json_encode(['exito' => false, 'mensaje' => 'Formato de fecha de ingreso inválido. Use AAAA-MM-DD o DD/MM/AAAA.']);
                exit;
            }
            $set[] = "ingreso = ?";
            $val[] = $ingNorm;
        }

        if (empty($set)) {
            echo json_encode(['exito' => false, 'mensaje' => 'Sin cambios para actualizar']);
            exit;
        }

        $val[] = $id;

        $sql = "UPDATE alumnos SET " . implode(', ', $set) . " WHERE id_alumno = ?";
        $st = $pdo->prepare($sql);
        $st->execute($val);

        echo json_encode(['exito' => true, 'mensaje' => 'ALUMNO ACTUALIZADO CORRECTAMENTE']);
        exit;
    }

    echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()]);
}
