<?php
// backend/modules/alumnos/familias/familia_guardar.php
// ✅ Sin _common.php

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function fam_json($arr, $code = 200) {
    http_response_code((int)$code);
    echo json_encode($arr, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        fam_json(['exito' => false, 'mensaje' => 'Método no permitido'], 405);
    }

    $raw = file_get_contents('php://input');
    $raw = ($raw === false) ? '' : $raw;
    $input = json_decode($raw, true);
    if (!is_array($input)) fam_json(['exito' => false, 'mensaje' => 'JSON inválido'], 400);

    $id_familia = isset($input['id_familia']) ? $input['id_familia'] : null;

    if ($id_familia !== '' && $id_familia !== null) {
        require __DIR__ . '/editar_familia.php';
    } else {
        require __DIR__ . '/agregar_familia.php';
    }
} catch (Throwable $e) {
    fam_json(['exito' => false, 'mensaje' => 'Error inesperado en familia_guardar', 'error' => $e->getMessage()], 500);
}
