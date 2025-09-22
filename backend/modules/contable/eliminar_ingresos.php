<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

try {
    if (!isset($pdo)) {
        require_once __DIR__ . '/../../config/db.php'; // <-- ajustá si corresponde
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    $raw = file_get_contents('php://input');
    $in = json_decode($raw, true) ?: [];
    $id = (int)($in['id_ingreso'] ?? 0);

    if ($id <= 0) {
        http_response_code(200);
        echo json_encode(['exito'=>false,'mensaje'=>'ID inválido.']);
        exit;
    }

    $st = $pdo->prepare("DELETE FROM ingresos WHERE id_ingreso = :id");
    $st->execute([':id'=>$id]);

    echo json_encode(['exito'=>true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode(['exito'=>false,'mensaje'=>'Error al eliminar: '.$e->getMessage()]);
}
