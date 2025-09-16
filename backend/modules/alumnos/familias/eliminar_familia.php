<?php
require_once __DIR__ . '/_common.php';

$pdo   = fam_pdo();
$input = json_decode(file_get_contents('php://input'), true) ?: [];

$id_familia = fam_int_or_null($input['id_familia'] ?? null);
$forzar     = (int)!!($input['forzar'] ?? 0);

if (!$id_familia) fam_json(['exito' => false, 'mensaje' => 'id_familia requerido'], 400);

// ¿Tiene alumnos?
$st = $pdo->prepare("SELECT COUNT(*) FROM alumnos WHERE id_familia = :id");
$st->execute([':id' => $id_familia]);
$count = (int)$st->fetchColumn();

if ($count > 0 && !$forzar) {
    fam_json([
        'exito' => false,
        'mensaje' => 'La familia tiene alumnos vinculados. Quitá los miembros o borrá forzando.',
        'miembros' => $count
    ], 409);
}

if ($forzar) {
    $pdo->prepare("UPDATE alumnos SET id_familia = NULL WHERE id_familia = :id")
        ->execute([':id' => $id_familia]);
}

$ok = $pdo->prepare("DELETE FROM familias WHERE id_familia = :id")
          ->execute([':id' => $id_familia]);

fam_json(['exito' => $ok, 'mensaje' => $ok ? 'Familia eliminada' : 'No se pudo eliminar']);
