<?php
// backend/modules/tipos_documentos/eliminar_documentos.php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    if (!($pdo instanceof PDO)) throw new RuntimeException('Conexión no disponible.');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('SET NAMES utf8mb4');

    $id = (int)($_POST['id'] ?? 0);
    if ($id <= 0) throw new InvalidArgumentException('ID inválido.');

    $st = $pdo->prepare("DELETE FROM tipos_documentos WHERE id_tipo_documento = :id");
    $st->execute([':id' => $id]);

    echo json_encode(['exito' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(400);
    $msg = $e->getMessage();
    // Mensaje más claro si hay FK
    if (stripos($msg, 'foreign key') !== false || stripos($msg, 'constraint') !== false) {
        $msg = 'No se puede eliminar: existe(n) registro(s) que utilizan este tipo de documento.';
    }
    echo json_encode(['exito' => false, 'mensaje' => $msg], JSON_UNESCAPED_UNICODE);
}
