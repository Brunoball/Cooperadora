<?php
// backend/modules/global/medio_pago_crear.php
declare(strict_types=1);
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    $raw = file_get_contents('php://input');
    $in  = json_decode($raw, true) ?: [];

    $nombre = strtoupper(trim((string)($in['nombre'] ?? '')));
    if ($nombre === '') {
        throw new InvalidArgumentException('El nombre del medio de pago es obligatorio.');
    }
    if (mb_strlen($nombre) > 100) {
        throw new InvalidArgumentException('El medio de pago no puede superar 100 caracteres.');
    }

    // Evitar duplicados (case-insensitive)
    $st = $pdo->prepare("SELECT id_medio_pago FROM medio_pago WHERE UPPER(medio_pago)=:n LIMIT 1");
    $st->execute([':n' => $nombre]);
    $existe = $st->fetchColumn();

    if ($existe) {
        echo json_encode([
            'exito'  => true,
            'id'     => (int)$existe,
            'nombre' => $nombre,
            'mensaje'=> 'Ya existía; se reutiliza.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $ins = $pdo->prepare("INSERT INTO medio_pago (medio_pago) VALUES (:n)");
    $ins->execute([':n' => $nombre]);
    $id = (int)$pdo->lastInsertId();

    echo json_encode(['exito' => true, 'id' => $id, 'nombre' => $nombre], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
