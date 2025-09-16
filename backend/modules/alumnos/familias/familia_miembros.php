<?php
require_once __DIR__ . '/_common.php';

$pdo = fam_pdo();
$id_familia = isset($_GET['id_familia']) ? (int)$_GET['id_familia'] : 0;
if ($id_familia <= 0) fam_json(['exito' => false, 'mensaje' => 'id_familia inválido'], 400);

$sql = "SELECT 
            a.id_alumno,
            a.apellido,
            a.nombre,
            a.num_documento AS dni,        -- alias para compat
            a.domicilio,
            a.localidad,
            a.activo,
            CONCAT(a.apellido, ', ', IFNULL(a.nombre, '')) AS nombre_completo
        FROM alumnos a
        WHERE a.id_familia = :id
        ORDER BY a.apellido ASC, a.nombre ASC";
$st = $pdo->prepare($sql);
$st->execute([':id' => $id_familia]);
$rows = $st->fetchAll(PDO::FETCH_ASSOC);

fam_json(['exito' => true, 'miembros' => $rows]);
