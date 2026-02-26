<?php
declare(strict_types=1);

// backend/modules/alumnos/familias/route.php

function route_alumnos_familias(string $action): bool
{
    switch ($action) {

        /* ===== Listado ===== */
        case 'familias_listar':
            require __DIR__ . '/familias_listar.php';
            return true;

        /* ===== Crear / Editar (si los usás) ===== */
        case 'familia_agregar':
            require __DIR__ . '/agregar_familia.php';
            return true;

        case 'familia_editar':
            require __DIR__ . '/editar_familia.php';
            return true;

        /* ===== Guardar (React usa este) ===== */
        case 'familia_guardar':
            require __DIR__ . '/familia_guardar.php';
            return true;

        /* ===== Eliminar (React usa este) ===== */
        case 'familia_eliminar':
            require __DIR__ . '/eliminar_familia.php';
            return true;

        /* ===== Miembros (React usa este) ===== */
        case 'familia_miembros':
            require __DIR__ . '/familia_miembros.php';
            return true;

        case 'familia_agregar_miembros':
            require __DIR__ . '/familia_agregar_miembros.php';
            return true;

        case 'familia_quitar_miembro':
            require __DIR__ . '/familia_quitar_miembro.php';
            return true;

        /* ===== Alumnos sin familia ===== */
        case 'alumnos_sin_familia':
        case 'socios_sin_familia':
            require __DIR__ . '/alumnos_sin_familia.php';
            return true;

        /* ===== EXPORT EXCEL (TE FALTABA) ===== */
        case 'familias_exportar_excel':
            // ✅ Si tenés este archivo, perfecto.
            // Si todavía no existe, dejalo creado (aunque sea placeholder) para no romper el front.
            require __DIR__ . '/familias_exportar_excel.php';
            return true;

        /* ===== Alias opcionales por compatibilidad ===== */
        case 'familia_agregar_miembro':
            // si en algún lugar te quedó en singular, lo redirigimos al plural
            require __DIR__ . '/familia_agregar_miembros.php';
            return true;
    }

    return false;
}