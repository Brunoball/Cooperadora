<?php
declare(strict_types=1);

// backend/modules/categorias/obtener_cat_hermanos.php

require_once __DIR__ . '/../../config/db.php';

try {

    // 🔹 Validar conexión
    if (!isset($pdo) || !($pdo instanceof PDO)) {
        json_out(['exito' => false, 'mensaje' => 'Conexión PDO no disponible.'], 500);
    }

    // 🔹 Obtener parámetro
    $id_cat_monto = isset($_GET['id_cat_monto']) ? (int)$_GET['id_cat_monto'] : 0;

    if ($id_cat_monto <= 0) {
        json_out(['exito' => false, 'mensaje' => 'id_cat_monto inválido'], 400);
    }

    // 🔹 Consulta
    $st = $pdo->prepare("
        SELECT
            ch.id_cat_hermanos,
            ch.id_cat_monto,
            ch.cantidad_hermanos,
            ch.monto_mensual,
            ch.monto_anual,
            ch.activo,
            ch.creado_en,
            ch.actualizado_en
        FROM cooperadora.categoria_hermanos ch
        WHERE ch.id_cat_monto = :id
          AND ch.activo = 1
        ORDER BY ch.cantidad_hermanos ASC
    ");

    $st->execute([':id' => $id_cat_monto]);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    // 🔹 Respuesta OK
    json_out([
        'exito' => true,
        'items' => $rows
    ]);

} catch (Throwable $e) {

    json_out([
        'exito' => false,
        'mensaje' => 'Error al obtener categorías de hermanos',
        'detalle' => $e->getMessage()
    ], 500);
}