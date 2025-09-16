<?php
require_once __DIR__ . '/_common.php';

$pdo   = fam_pdo();
$input = json_decode(file_get_contents('php://input'), true) ?: [];

$id_familia    = fam_int_or_null($input['id_familia'] ?? null);
$nombre        = fam_str($input['nombre_familia'] ?? '');
$observaciones = fam_str($input['observaciones'] ?? '');
$activo        = isset($input['activo']) ? (int)!!$input['activo'] : 1;

if (!$id_familia) fam_json(['exito' => false, 'mensaje' => 'id_familia requerido'], 400);
if ($nombre === '') fam_json(['exito' => false, 'mensaje' => 'El nombre de la familia es obligatorio.'], 400);

$sql = "UPDATE familias
        SET nombre_familia = :n,
            observaciones  = :o,
            activo         = :a,
            actualizado_en = CURDATE()
        WHERE id_familia   = :id";
$ok = $pdo->prepare($sql)->execute([
    ':n'  => $nombre,
    ':o'  => ($observaciones !== '' ? $observaciones : null),
    ':a'  => $activo,
    ':id' => $id_familia,
]);

fam_json(['exito' => $ok, 'mensaje' => $ok ? 'Familia actualizada' : 'No se pudo actualizar']);
