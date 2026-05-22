<?php
// backend/modules/ventas/route.php

function route_ventas($action) {
    switch ($action) {
        case 'ventas_dashboard':
            require __DIR__ . '/dashboard.php';
            return true;

        case 'ventas_campanias':
        case 'ventas_campania_guardar':
        case 'ventas_campania_eliminar':
        case 'ventas_campania_estado':
            require __DIR__ . '/campanias.php';
            return true;

        case 'ventas_productos':
        case 'ventas_producto_guardar':
        case 'ventas_producto_eliminar':
        case 'ventas_producto_estado':
            require __DIR__ . '/productos.php';
            return true;

        case 'ventas_ordenes':
        case 'ventas_orden_guardar':
        case 'ventas_medios_pago':
            require __DIR__ . '/ordenes.php';
            return true;

        // Endpoint preparado para que el bot consulte si debe mostrar la opción del menú.
        case 'ventas_menu_activo':
            require __DIR__ . '/menu_activo.php';
            return true;
    }

    return false;
}
