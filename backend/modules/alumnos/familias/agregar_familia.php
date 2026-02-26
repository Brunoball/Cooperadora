<?php
// backend/modules/alumnos/familias/agregar_familia.php
// ✅ Sin _common.php (compatible PHP 7/8)

if (!function_exists('fam_json')) {
  function fam_json($arr, $code = 200) {
    http_response_code((int)$code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($arr, JSON_UNESCAPED_UNICODE);
    exit;
  }
}

require_once __DIR__ . '/../../../config/db.php';

try {
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    fam_json(['exito' => false, 'mensaje' => 'Conexión PDO no disponible. Revisá backend/config/db.php'], 500);
  }

  $raw = file_get_contents('php://input');
  $raw = ($raw === false) ? '' : $raw;
  $input = json_decode($raw, true);
  if (!is_array($input)) $input = [];

  $nombre = strtoupper(trim((string)($input['nombre_familia'] ?? '')));
  $obs    = strtoupper(trim((string)($input['observaciones'] ?? '')));
  $activo = isset($input['activo']) ? (int)(!!$input['activo']) : 1;

  if ($nombre === '') fam_json(['exito' => false, 'mensaje' => 'El apellido es obligatorio.'], 422);
  if (mb_strlen($nombre, 'UTF-8') > 120) fam_json(['exito' => false, 'mensaje' => 'El apellido supera el máximo (120).'], 422);

  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  $sql = "
    INSERT INTO familias (nombre_familia, observaciones, activo, creado_en, actualizado_en)
    VALUES (:n, :o, :a, NOW(), NOW())
  ";
  $st = $pdo->prepare($sql);
  $st->execute([
    ':n' => $nombre,
    ':o' => ($obs !== '' ? $obs : null),
    ':a' => $activo,
  ]);

  fam_json(['exito' => true, 'mensaje' => 'Familia creada', 'id_familia' => (int)$pdo->lastInsertId()]);

} catch (PDOException $e) {
  // 23000 => unique constraint
  if ((string)$e->getCode() === '23000') {
    fam_json(['exito' => false, 'mensaje' => 'Ya existe una familia con ese apellido.'], 409);
  }
  fam_json(['exito' => false, 'mensaje' => 'Error de base de datos al crear familia.', 'error' => $e->getMessage()], 500);

} catch (Throwable $e) {
  fam_json(['exito' => false, 'mensaje' => 'Error inesperado al crear familia.', 'error' => $e->getMessage()], 500);
}
