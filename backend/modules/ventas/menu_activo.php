<?php
// backend/modules/ventas/menu_activo.php
// Endpoint preparado para el bot de WhatsApp: devuelve la única venta activa disponible.

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

try {
    $pdo = ventas_pdo();
    ventas_tablas_verificadas($pdo);

    $sql = "
        SELECT
            c.id_campania,
            c.nombre,
            p.descripcion AS descripcion,
            'vendedor' AS tipo_persona,
            'dni_persona' AS tipo_flujo,
            'dni' AS dato_requerido,
            c.pregunta_persona,
            c.mensaje_inicio,
            c.mensaje_aprobado,
            c.fecha_inicio,
            c.fecha_fin,
            p.id_producto,
            p.nombre AS producto_nombre,
            p.descripcion AS producto_descripcion,
            p.precio AS producto_precio,
            p.stock AS producto_stock
        FROM ventas_campanias c
        INNER JOIN ventas_productos p ON p.id_producto = c.id_producto_principal AND p.activo = 1
        WHERE c.activo = 1
          AND c.visible_menu = 1
          AND (c.fecha_inicio IS NULL OR c.fecha_inicio <= CURDATE())
          AND (c.fecha_fin IS NULL OR c.fecha_fin >= CURDATE())
        ORDER BY c.id_campania DESC
        LIMIT 1
    ";
    $campania = $pdo->query($sql)->fetch(PDO::FETCH_ASSOC) ?: null;

    if (!$campania) {
        ventas_json([
            'exito' => true,
            'mostrar_opcion_menu' => false,
            'campania_activa' => null,
            'campanias' => [],
        ]);
    }

    $producto = [
        'id_producto' => $campania['id_producto'],
        'id_campania' => $campania['id_campania'],
        'nombre' => $campania['producto_nombre'],
        'descripcion' => $campania['producto_descripcion'],
        'precio' => $campania['producto_precio'],
        'stock' => $campania['producto_stock'],
    ];

    unset(
        $campania['id_producto'],
        $campania['producto_nombre'],
        $campania['producto_descripcion'],
        $campania['producto_precio'],
        $campania['producto_stock']
    );

    $campania['producto_principal'] = $producto;
    $campania['productos'] = [$producto];

    ventas_json([
        'exito' => true,
        'mostrar_opcion_menu' => true,
        'campania_activa' => $campania,
        'campanias' => [$campania],
    ]);
} catch (Throwable $e) {
    ventas_json(['exito' => false, 'mostrar_opcion_menu' => false, 'mensaje' => $e->getMessage()], 200);
}
