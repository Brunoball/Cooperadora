<?php
// backend/routes/api.php
declare(strict_types=1);

/* =========================
   CORS
   ========================= */
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

if ($origin && in_array($origin, $allowed, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header('Access-Control-Allow-Credentials: true');
  header('Vary: Origin');
} else {
  // Si NO hay origin permitido, evitamos credenciales.
  header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Session');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

date_default_timezone_set('America/Argentina/Cordoba');
mb_internal_encoding('UTF-8');

/* =========================
   Helpers
   ========================= */
function json_out(array $payload, int $code = 200): void {
  http_response_code($code);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

function dbg_log(string $msg): void {
  error_log('[API] ' . $msg);
}

/* =========================
   Action
   ========================= */
$action = trim((string)($_GET['action'] ?? ''));

/*
  ✅ Alias/compat (si en el frontend quedó un action viejo)
  Ajustá acá tus equivalencias reales si hace falta.
*/
$aliases = [
  // Ejemplo: si tu frontend pide meses_list pero vos lo querés resolver en contable.
  'meses_list' => 'meses_list',
];

if ($action !== '' && isset($aliases[$action])) {
  $action = $aliases[$action];
}

try {
  // Log mínimo para depurar
  $m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  $u = $_SERVER['REQUEST_URI'] ?? '';
  dbg_log("{$m} {$u} action={$action}");

  if ($action === '') {
    json_out(['exito' => false, 'mensaje' => 'Falta action'], 400);
  }

  /* =========================
     Includes de rutas por módulo
     ========================= */
  require_once __DIR__ . '/../modules/login/route.php';
  require_once __DIR__ . '/../modules/alumnos/route.php';
  require_once __DIR__ . '/../modules/global/route.php';
  require_once __DIR__ . '/../modules/cuotas/route.php';
  require_once __DIR__ . '/../modules/contable/route.php';
  require_once __DIR__ . '/../modules/tipos_documentos/route.php';
  require_once __DIR__ . '/../modules/categorias/route.php';

  /* =========================
     Router (orden importa)
     ========================= */
  if (function_exists('route_login') && route_login($action)) exit;
  if (function_exists('route_alumnos') && route_alumnos($action)) exit;
  if (function_exists('route_global') && route_global($action)) exit;
  if (function_exists('route_cuotas') && route_cuotas($action)) exit;
  if (function_exists('route_contable') && route_contable($action)) exit;
  if (function_exists('route_tipos_documentos') && route_tipos_documentos($action)) exit;
  if (function_exists('route_categorias') && route_categorias($action)) exit;

  json_out([
    'exito' => false,
    'mensaje' => 'Acción no válida: ' . $action,
  ], 404);

} catch (Throwable $e) {
  dbg_log("ROUTER ERROR action={$action}: " . $e->getMessage() . "\n" . $e->getTraceAsString());
  json_out([
    'exito' => false,
    'mensaje' => 'Error interno del servidor. Revisá la consola del backend (php -S).',
    // 'debug' => $e->getMessage(), // si querés
  ], 500);
}