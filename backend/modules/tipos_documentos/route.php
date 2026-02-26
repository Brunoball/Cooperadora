<?php
declare(strict_types=1);

// backend/modules/tipos_documentos/route.php

function route_tipos_documentos(string $action): bool
{
    switch ($action) {
        case 'td_listar':
            require __DIR__ . '/listar_documentos.php';
            return true;

        case 'td_crear':
            require __DIR__ . '/crear_documentos.php';
            return true;

        case 'td_actualizar':
            require __DIR__ . '/editar_documentos.php';
            return true;

        case 'td_eliminar':
            require __DIR__ . '/eliminar_documentos.php';
            return true;
    }

    return false;
}
