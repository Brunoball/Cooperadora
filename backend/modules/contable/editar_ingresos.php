<?php
declare(strict_types=1);

// Devuelve JSON siempre
header('Content-Type: application/json; charset=utf-8');

try {
    // Conexión
    if (!isset($pdo)) {
        require_once __DIR__ . '/../../config/db.php'; // <-- ajustá si tu archivo se llama distinto
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    // Cuerpo JSON
    $raw = file_get_contents('php://input');
    $in = json_decode($raw, true) ?: [];

    $id    = (int)($in['id_ingreso'] ?? 0);
    $fecha = $in['fecha'] ?? null;
    $denom = trim((string)($in['denominacion'] ?? ''));
    $desc  = trim((string)($in['descripcion'] ?? ''));
    $imp   = (float)($in['importe'] ?? 0);
    $mp    = (int)($in['id_medio_pago'] ?? 0);

    if ($id <= 0 || !$fecha || !$denom || $imp <= 0 || $mp <= 0) {
        http_response_code(200);
        echo json_encode(['exito'=>false,'mensaje'=>'Datos inválidos para actualizar.']);
        exit;
    }

    $sql = "UPDATE ingresos
            SET fecha = :f, denominacion = :d, descripcion = :x, importe = :i, id_medio_pago = :m
            WHERE id_ingreso = :id";
    $st = $pdo->prepare($sql);
    $st->execute([
        ':f'=>$fecha,
        ':d'=>$denom,
        ':x'=>($desc !== '' ? $desc : null),
        ':i'=>$imp,
        ':m'=>$mp,
        ':id'=>$id
    ]);

    echo json_encode(['exito'=>true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode(['exito'=>false,'mensaje'=>'Error al actualizar: '.$e->getMessage()]);
}
