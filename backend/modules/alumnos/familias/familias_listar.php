<?php
// backend/modules/alumnos/familias/familias_listar.php
// ✅ Sin _common.php (compatible PHP 7/8)

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../../../config/db.php';

function fam_json($arr, $code = 200) {
    http_response_code((int)$code);
    echo json_encode($arr, JSON_UNESCAPED_UNICODE);
    exit;
}

if (!isset($pdo) || !($pdo instanceof PDO)) {
    fam_json(['exito' => false, 'mensaje' => 'Conexión PDO no disponible. Revisá backend/config/db.php'], 500);
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        fam_json(['exito' => false, 'mensaje' => 'Método no permitido. Usá GET.'], 405);
    }

    $sql = "
        SELECT
            f.id_familia,
            f.nombre_familia,
            f.observaciones,
            f.activo,
            DATE(f.creado_en)       AS creado_en,
            DATE(f.actualizado_en)  AS actualizado_en,
            DATE_FORMAT(f.creado_en, '%d/%m/%Y') AS fecha_alta,

            /* Contadores con ALUMNOS */
            (SELECT COUNT(*) FROM alumnos a WHERE a.id_familia = f.id_familia AND a.activo = 1) AS miembros_activos,
            (SELECT COUNT(*) FROM alumnos a WHERE a.id_familia = f.id_familia)                  AS miembros_totales
        FROM familias f
        ORDER BY f.nombre_familia ASC
    ";

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

    fam_json(['exito' => true, 'familias' => $rows]);
} catch (Throwable $e) {
    fam_json(['exito' => false, 'mensaje' => 'Error al listar familias', 'error' => $e->getMessage()], 500);
}
