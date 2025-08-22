<?php
// backend/modules/alumnos/dar_alta_alumno.php
declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(0);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    require_once __DIR__ . '/../../config/db.php'; // Debe definir $pdo (PDO)
    if (!($pdo instanceof PDO)) {
        http_response_code(500);
        echo json_encode(['exito' => false, 'mensaje' => 'Conexión PDO no disponible']);
        exit;
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
        exit;
    }

    // ==== Leer parámetros (preferir x-www-form-urlencoded) ====
    $id_alumno = 0;
    $fechaIngresada = '';

    if (!empty($_POST)) {
        $id_alumno = isset($_POST['id_alumno']) ? (int)$_POST['id_alumno'] : 0;
        $fechaIngresada = isset($_POST['fecha_ingreso']) ? trim((string)$_POST['fecha_ingreso']) : '';
    } else {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (is_array($data)) {
            $id_alumno = isset($data['id_alumno']) ? (int)$data['id_alumno'] : 0;
            $fechaIngresada = isset($data['fecha_ingreso']) ? trim((string)$data['fecha_ingreso']) : '';
        }
    }

    if ($id_alumno <= 0) {
        http_response_code(422);
        echo json_encode(['exito' => false, 'mensaje' => 'ID de alumno inválido']);
        exit;
    }

    // ==== Normalizar fecha a Y-m-d (acepta Y-m-d o d/m/Y). Null => inválida ====
    $fechaValida = normalizarFecha($fechaIngresada);

    // ==== Nombres de tabla/columnas (según esquema que pasaste) ====
    // Tabla: cooperadora.alumnos (no calificamos el esquema para usar la DB activa del $pdo)
    $tabla      = '`alumnos`';
    $colId      = 'id_alumno';
    $colActivo  = 'activo';
    $colMotivo  = 'motivo';
    $colIngreso = 'ingreso';

    if ($fechaValida !== null) {
        $sql = "UPDATE {$tabla}
                   SET {$colActivo} = 1,
                       {$colMotivo} = NULL,
                       {$colIngreso} = :fecha
                 WHERE {$colId} = :id
                 LIMIT 1";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':fecha' => $fechaValida, ':id' => $id_alumno]);
        $usada = $fechaValida;
    } else {
        $sql = "UPDATE {$tabla}
                   SET {$colActivo} = 1,
                       {$colMotivo} = NULL,
                       {$colIngreso} = CURDATE()
                 WHERE {$colId} = :id
                 LIMIT 1";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':id' => $id_alumno]);
        $usada = 'CURDATE()';
    }

    // Si no afectó filas, verificar existencia
    if ($stmt->rowCount() === 0) {
        $chk = $pdo->prepare("SELECT {$colId} FROM {$tabla} WHERE {$colId} = :id LIMIT 1");
        $chk->execute([':id' => $id_alumno]);
        if (!$chk->fetch()) {
            http_response_code(404);
            echo json_encode(['exito' => false, 'mensaje' => 'Alumno no encontrado']);
            exit;
        }
        // Existe pero ya estaba con esos valores; lo tomamos como éxito.
    }

    echo json_encode([
        'exito'       => true,
        'mensaje'     => 'Alumno dado de alta correctamente',
        'fecha_usada' => $usada
    ], JSON_UNESCAPED_UNICODE);
    exit;

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al dar de alta al alumno: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Convierte una fecha string a 'Y-m-d' si es válida.
 * Acepta 'Y-m-d' o 'd/m/Y'. Devuelve null si no es válida.
 */
function normalizarFecha(string $s): ?string {
    $s = trim($s);
    if ($s === '') return null;

    // YYYY-MM-DD
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
        $dt  = DateTime::createFromFormat('Y-m-d', $s);
        $err = DateTime::getLastErrors();
        if ($dt && empty($err['warning_count']) && empty($err['error_count'])) {
            return $dt->format('Y-m-d');
        }
    }

    // DD/MM/YYYY
    if (preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $s)) {
        $dt  = DateTime::createFromFormat('d/m/Y', $s);
        $err = DateTime::getLastErrors();
        if ($dt && empty($err['warning_count']) && empty($err['error_count'])) {
            return $dt->format('Y-m-d');
        }
    }

    return null;
}
