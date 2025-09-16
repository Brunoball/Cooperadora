<?php
require_once __DIR__ . '/_common.php';

$pdo   = fam_pdo();
$input = json_decode(file_get_contents('php://input'), true) ?: [];

$id_alumno = fam_int_or_null($input['id_alumno'] ?? null);
if (!$id_alumno) {
    /* Compat: aceptar id_socio */
    $id_alumno = fam_int_or_null($input['id_socio'] ?? null);
}

if (!$id_alumno) fam_json(['exito' => false, 'mensaje' => 'id_alumno requerido'], 400);

$ok = $pdo->prepare("UPDATE alumnos SET id_familia = NULL WHERE id_alumno = :a")
          ->execute([':a' => $id_alumno]);

fam_json(['exito' => $ok, 'mensaje' => $ok ? 'Miembro quitado' : 'No se pudo quitar']);
