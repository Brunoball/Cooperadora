<?php
declare(strict_types=1);

require_once __DIR__ . '/_common.php';

header('Content-Type: application/json; charset=UTF-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        fam_json(['exito' => false, 'mensaje' => 'Método no permitido'], 405);
    }

    $raw   = file_get_contents('php://input') ?: '';
    $input = json_decode($raw, true);
    if (!is_array($input)) fam_json(['exito' => false, 'mensaje' => 'JSON inválido'], 400);

    $id_familia = $input['id_familia'] ?? null;

    if ($id_familia !== '' && $id_familia !== null) {
        require __DIR__ . '/editar_familia.php';
    } else {
        require __DIR__ . '/agregar_familia.php';
    }
} catch (Throwable $e) {
    fam_json(['exito' => false, 'mensaje' => 'Error inesperado en familia_guardar', 'error' => $e->getMessage()], 500);
}
