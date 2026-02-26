<?php
// backend/modules/alumnos/familias/familia_miembros.php
// Devuelve alumnos vinculados a una familia

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Vary: Origin');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Session');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

function fam_json(array $arr, int $code = 200): void {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

require_once __DIR__ . '/../../../config/db.php';

try {
  if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    fam_json(['exito' => false, 'mensaje' => 'Método no permitido. Usá GET.'], 405);
  }

  // 🔒 Asegurar PDO disponible
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    fam_json(['exito' => false, 'mensaje' => 'Conexión PDO no disponible. Revisá backend/config/db.php'], 500);
  }

  $id = isset($_GET['id_familia']) ? (int)$_GET['id_familia'] : 0;
  if ($id <= 0) {
    fam_json(['exito' => false, 'mensaje' => 'id_familia inválido'], 400);
  }

  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  // ✅ SQL limpio (sin "\")
  $sql = "
    SELECT
      a.id_alumno,
      a.apellido,
      a.nombre,
      a.num_documento,
      a.localidad,
      a.activo
    FROM alumnos a
    WHERE a.id_familia = :id
    ORDER BY a.apellido ASC, a.nombre ASC
  ";

  $st = $pdo->prepare($sql);
  $st->execute([':id' => $id]);
  $rows = $st->fetchAll(PDO::FETCH_ASSOC);

  $out = [];
  foreach ($rows as $r) {
    $apellido = (string)($r['apellido'] ?? '');
    $nombre   = (string)($r['nombre'] ?? '');
    $dni      = (string)($r['num_documento'] ?? '');

    $out[] = [
      'id_alumno' => (int)($r['id_alumno'] ?? 0),
      'apellido' => $apellido,
      'nombre' => $nombre,
      'nombre_completo' => trim($apellido . ' ' . $nombre),
      'dni' => $dni,
      'num_documento' => $dni,
      'localidad' => (string)($r['localidad'] ?? ''),
      'activo' => (int)($r['activo'] ?? 0),
    ];
  }

  fam_json(['exito' => true, 'miembros' => $out]);

} catch (Throwable $e) {
  // Log REAL para ver el motivo exacto en consola
  error_log("familia_miembros ERROR: " . $e->getMessage());
  fam_json(['exito' => false, 'mensaje' => 'Error al obtener miembros', 'error' => $e->getMessage()], 500);
}