<?php
declare(strict_types=1);

function route_ingresantes(string $action): bool
{
    switch ($action) {
        case 'ingresantes_listar':
            require __DIR__ . '/listar.php';
            return true;

        case 'ingresantes_guardar':
            require __DIR__ . '/guardar.php';
            return true;

        case 'ingresantes_eliminar':
            require __DIR__ . '/eliminar.php';
            return true;
    }

    return false;
}
