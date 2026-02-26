<?php
declare(strict_types=1);

// backend/modules/alumnos/route.php

require_once __DIR__ . '/familias/route.php';

function route_alumnos(string $action): bool
{
    switch ($action) {
        case 'alumnos':
            require __DIR__ . '/obtener_alumnos.php';
            return true;

        case 'alumnos_baja':
            require __DIR__ . '/alumnos_baja.php';
            return true;

        case 'agregar_alumno':
            require __DIR__ . '/agregar_alumno.php';
            return true;

        case 'editar_alumno':
            require __DIR__ . '/editar_alumno.php';
            return true;

        case 'eliminar_alumno':
            require __DIR__ . '/eliminar_alumno.php';
            return true;

        case 'dar_baja_alumno':
            require __DIR__ . '/dar_baja_alumno.php';
            return true;

        case 'dar_alta_alumno':
            require __DIR__ . '/dar_alta_alumno.php';
            return true;

        case 'eliminar_bajas':
            require __DIR__ . '/eliminar_bajas.php';
            return true;

        case 'toggle_cobrador':
            require __DIR__ . '/toggle_cobrador.php';
            return true;
    }

    // ✅ Fallback a sub-routes (familias)
    if (function_exists('route_alumnos_familias')) {
        return route_alumnos_familias($action);
    }

    return false;
}