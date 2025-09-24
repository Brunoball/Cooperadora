<?php
// backend/modules/cuotas/matricula.php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

// CORS (incluye preflight)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/**
 * Lee el cuerpo JSON si existe; si no, intenta con form-data.
 */
function read_request_data(): array {
    $raw = file_get_contents('php://input');
    $json = json_decode($raw, true);
    if (is_array($json)) return $json;
    if (!empty($_POST)) return $_POST;
    return [];
}

/**
 * Crea el registro de MATRÍCULA (id 14) si no existe.
 * NOTA: Solo se usa la tabla 'meses' (sin prefijo de base).
 */
function ensure_matricula_exists(PDO $pdo, int $montoDefault = 15000): void {
    $stmt = $pdo->prepare("
        INSERT INTO meses (id_mes, nombre, monto)
        VALUES (14, 'MATRICULA', :monto)
        ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)
    ");
    $stmt->execute([':monto' => $montoDefault]);
}

try {
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        // Obtener monto actual (solo tabla 'meses')
        $stmt = $pdo->prepare("SELECT monto FROM meses WHERE id_mes = 14 LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            // Si no existe, lo creamos con 15000 por defecto
            ensure_matricula_exists($pdo, 15000);
            $monto = 15000;
        } else {
            $monto = (int)($row['monto'] ?? 0);
        }

        echo json_encode(['exito' => true, 'monto' => $monto], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($method === 'POST') {
        // Actualizar monto (solo tabla 'meses')
        $data = read_request_data();
        if (!isset($data['monto'])) {
            http_response_code(400);
            echo json_encode(['exito' => false, 'mensaje' => 'Falta el parámetro "monto".'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $monto = (int)$data['monto'];
        if ($monto < 0) {
            http_response_code(400);
            echo json_encode(['exito' => false, 'mensaje' => 'El monto no puede ser negativo.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $pdo->beginTransaction();
        $stmt = $pdo->prepare("
            INSERT INTO meses (id_mes, nombre, monto)
            VALUES (14, 'MATRICULA', :monto)
            ON DUPLICATE KEY UPDATE monto = VALUES(monto), nombre = VALUES(nombre)
        ");
        $stmt->execute([':monto' => $monto]);
        $pdo->commit();

        echo json_encode(['exito' => true, 'monto' => $monto, 'mensaje' => 'Matrícula actualizada.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Método no permitido
    http_response_code(405);
    echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido. Usá GET o POST.'], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
