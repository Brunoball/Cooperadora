<?php
// backend/modules/contable/agregar_descripcion.php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido. Usá POST.']);
        exit;
    }

    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    // Acepta JSON o form-data. Conservamos la clave 'texto' del frontend.
    $raw = json_decode(file_get_contents('php://input'), true);
    if (!is_array($raw)) {
        $raw = $_POST;
    }

    $texto = strtoupper(trim((string)($raw['texto'] ?? '')));
    $texto = preg_replace('/\s+/', ' ', $texto ?? '');

    if ($texto === '') {
        throw new RuntimeException('INGRESÁ LA NUEVA DESCRIPCIÓN.');
    }
    if (mb_strlen($texto) > 160) { // la tabla está en VARCHAR(160)
        throw new RuntimeException('LA DESCRIPCIÓN NO PUEDE SUPERAR 160 CARACTERES.');
    }

    // Insert en la nueva tabla contable_descripcion (sin schema)
    // UNIQUE esperado sobre nombre_descripcion
    $sql = "INSERT INTO contable_descripcion (nombre_descripcion)
            VALUES (:t)
            ON DUPLICATE KEY UPDATE nombre_descripcion = VALUES(nombre_descripcion)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':t' => $texto]);

    // Si ya existía, lastInsertId será 0: buscamos el id existente
    $id = (int)$pdo->lastInsertId();
    if ($id === 0) {
        $q = $pdo->prepare(
            "SELECT id_cont_descripcion
             FROM contable_descripcion
             WHERE nombre_descripcion = :t
             LIMIT 1"
        );
        $q->execute([':t' => $texto]);
        $id = (int)($q->fetchColumn() ?: 0);
    }

    if ($id <= 0) {
        throw new RuntimeException('No se pudo obtener el ID de la descripción.');
    }

    echo json_encode([
        'exito' => true,
        'id'    => $id,
        'texto' => $texto, // mantenemos el mismo nombre de campo que espera el frontend
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    // mantenemos 200 para manejo uniforme en frontend
    http_response_code(200);
    echo json_encode([
        'exito'   => false,
        'mensaje' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
