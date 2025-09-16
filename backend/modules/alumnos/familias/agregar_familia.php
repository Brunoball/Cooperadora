<?php
declare(strict_types=1);

require_once __DIR__ . '/_common.php';

header('Content-Type: application/json; charset=UTF-8');

try {
    $pdo   = fam_pdo();
    $input = json_decode(file_get_contents('php://input') ?: '', true) ?: [];

    $nombre = strtoupper(trim((string)($input['nombre_familia'] ?? '')));
    $obs    = strtoupper(trim((string)($input['observaciones'] ?? '')));
    $activo = isset($input['activo']) ? (int)!!$input['activo'] : 1;

    if ($nombre === '') fam_json(['exito' => false, 'mensaje' => 'El apellido es obligatorio.'], 422);
    if (mb_strlen($nombre) > 120) fam_json(['exito' => false, 'mensaje' => 'El apellido supera el máximo (120).'], 422);

    $sql = "
        INSERT INTO familias (nombre_familia, observaciones, activo, creado_en, actualizado_en)
        VALUES (:n, :o, :a, CURDATE(), CURDATE())
    ";
    $st = $pdo->prepare($sql);
    $st->execute([
        ':n' => $nombre,
        ':o' => ($obs !== '' ? $obs : null),
        ':a' => $activo,
    ]);

    fam_json(['exito' => true, 'mensaje' => 'Familia creada', 'id_familia' => (int)$pdo->lastInsertId()]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        fam_json(['exito' => false, 'mensaje' => 'Ya existe una familia con ese apellido.'], 409);
    }
    fam_json(['exito' => false, 'mensaje' => 'Error de base de datos al crear familia.', 'error' => $e->getMessage()], 500);
} catch (Throwable $e) {
    fam_json(['exito' => false, 'mensaje' => 'Error inesperado al crear familia.', 'error' => $e->getMessage()], 500);
}
