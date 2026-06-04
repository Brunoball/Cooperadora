<?php
/**
 * Compatibilidad para instalaciones/frontends viejos que todavía llamen
 * /api.php?action=editar_ingresos.
 *
 * La lógica real quedó unificada en ingresos.php con op=get|update.
 */
declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $_GET['op'] = 'update';
    $_POST['op'] = 'update';
    $_REQUEST['op'] = 'update';
} else {
    $_GET['op'] = 'get';
    $_REQUEST['op'] = 'get';
}

require __DIR__ . '/ingresos.php';
