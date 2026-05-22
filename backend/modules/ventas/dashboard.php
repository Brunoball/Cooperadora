<?php
// backend/modules/ventas/dashboard.php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

try {
    $pdo = ventas_pdo();
    ventas_tablas_verificadas($pdo);

    $hoy = date('Y-m-d');

    $campaniasTotal = (int)$pdo->query("SELECT COUNT(*) FROM ventas_campanias")->fetchColumn();
    $campaniasActivas = (int)$pdo->query("SELECT COUNT(*) FROM ventas_campanias WHERE activo = 1")->fetchColumn();
    $campaniasMenu = (int)$pdo->query("SELECT COUNT(*) FROM ventas_campanias c INNER JOIN ventas_productos p ON p.id_producto = c.id_producto_principal AND p.activo = 1 WHERE c.activo = 1 AND c.visible_menu = 1 AND (c.fecha_inicio IS NULL OR c.fecha_inicio <= CURDATE()) AND (c.fecha_fin IS NULL OR c.fecha_fin >= CURDATE())")->fetchColumn();
    $productosActivos = (int)$pdo->query("SELECT COUNT(*) FROM ventas_productos WHERE activo = 1")->fetchColumn();

    $st = $pdo->query("SELECT COUNT(*) AS cantidad, COALESCE(SUM(total), 0) AS total FROM ventas_ordenes WHERE estado = 'aprobada'");
    $aprobadas = $st->fetch(PDO::FETCH_ASSOC) ?: ['cantidad' => 0, 'total' => 0];

    ventas_json([
        'exito' => true,
        'hoy' => $hoy,
        'resumen' => [
            'campanias_total' => $campaniasTotal,
            'campanias_activas' => $campaniasActivas,
            'campanias_visibles_menu' => $campaniasMenu,
            'productos_activos' => $productosActivos,
            'ordenes_aprobadas' => (int)$aprobadas['cantidad'],
            'total_aprobado' => (float)$aprobadas['total'],
        ],
    ]);
} catch (Throwable $e) {
    ventas_json(['exito' => false, 'mensaje' => $e->getMessage()], 200);
}
