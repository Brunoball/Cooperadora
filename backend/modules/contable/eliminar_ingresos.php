<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

try {
    if (!isset($pdo)) {
        require_once __DIR__ . '/../../config/db.php'; // <-- ajustá si corresponde
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    $ventasHelper = __DIR__ . '/../ventas/helpers.php';
    if (is_file($ventasHelper)) {
        require_once $ventasHelper;
    }

    $raw = file_get_contents('php://input');
    $in = json_decode($raw, true) ?: [];
    $id = (int)($in['id_ingreso'] ?? 0);

    if ($id <= 0) {
        http_response_code(200);
        echo json_encode(['exito'=>false,'mensaje'=>'ID inválido.']);
        exit;
    }

    if (function_exists('ventas_table_exists') && ventas_table_exists($pdo, 'ventas_ordenes') && function_exists('ventas_column_exists') && ventas_column_exists($pdo, 'ventas_ordenes', 'id_ingreso')) {
        if (function_exists('ventas_contable_asegurar_tablas')) {
            ventas_contable_asegurar_tablas($pdo);
        }

        $qVenta = $pdo->prepare('SELECT id_orden FROM ventas_ordenes WHERE id_ingreso = :id LIMIT 1');
        $qVenta->execute([':id' => $id]);
        $idOrdenVenta = (int)($qVenta->fetchColumn() ?: 0);

        if ($idOrdenVenta > 0) {
            if (function_exists('ventas_column_exists') && ventas_column_exists($pdo, 'ventas_ordenes', 'contable_excluido')) {
                $upVenta = $pdo->prepare('UPDATE ventas_ordenes SET id_ingreso = NULL, contable_excluido = 1 WHERE id_orden = :id_orden LIMIT 1');
                $upVenta->execute([':id_orden' => $idOrdenVenta]);
            } else {
                $upVenta = $pdo->prepare('UPDATE ventas_ordenes SET id_ingreso = NULL WHERE id_orden = :id_orden LIMIT 1');
                $upVenta->execute([':id_orden' => $idOrdenVenta]);
            }
        }
    }

    $st = $pdo->prepare("DELETE FROM ingresos WHERE id_ingreso = :id");
    $st->execute([':id'=>$id]);

    echo json_encode(['exito'=>true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode(['exito'=>false,'mensaje'=>'Error al eliminar: '.$e->getMessage()]);
}
