<?php
declare(strict_types=1);

// backend/modules/global/route.php

function route_global(string $action): bool
{
    switch ($action) {
        case 'obtener_listas':
            require __DIR__ . '/obtener_listas.php';
            return true;
    }

    return false;
}
