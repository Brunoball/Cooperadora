<?php
// backend/modules/alumnos/obtener_alumnos.php
// ✅ Compatible PHP "viejo": sin strict_types, sin type-hints.
// ✅ Incluye campo: a.es_cobrador

header('Content-Type: application/json; charset=utf-8');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['exito' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

require_once __DIR__ . '/../../config/db.php';

try {
    if (!isset($pdo) || !($pdo instanceof PDO)) {
        throw new Exception('Conexión PDO no disponible.');
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    $q  = isset($_GET['q'])  ? trim((string)$_GET['q']) : '';
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    $sql = "
        SELECT
            a.id_alumno,
            a.apellido,
            a.nombre,
            CONCAT_WS(' ', a.apellido, a.nombre) AS apellido_nombre,
            a.num_documento AS dni,
            a.num_documento,
            a.id_tipo_documento,
            a.id_sexo,
            a.domicilio,
            a.localidad,
            a.cp,
            a.telefono,
            a.lugar_nacimiento,
            a.fecha_nacimiento,
            a.`id_año`,
            a.`id_division`,
            a.`id_categoria`,
            a.`id_cat_monto`,
            a.es_cobrador,
            a.activo,
            a.motivo,
            a.ingreso,
            a.observaciones,
            a.id_familia,

            an.`nombre_año`      AS anio_nombre,
            d.`nombre_division`  AS division_nombre,
            c.`nombre_categoria` AS categoria_nombre,

            -- Info de CATEGORIA_MONTO
            cm.`nombre_categoria`      AS catm_nombre,
            cm.`monto_mensual`         AS catm_monto_mensual,
            cm.`monto_anual`           AS catm_monto_anual,

            s.`sexo`             AS sexo_nombre,
            td.`descripcion`     AS tipo_documento_nombre,
            td.`sigla`           AS tipo_documento_sigla,

            f.`nombre_familia`   AS familia

        FROM alumnos a
        LEFT JOIN anio an             ON an.`id_año`             = a.`id_año`
        LEFT JOIN division d          ON d.`id_division`         = a.`id_division`
        LEFT JOIN categoria c         ON c.`id_categoria`        = a.`id_categoria`
        LEFT JOIN categoria_monto cm  ON cm.`id_cat_monto`       = a.`id_cat_monto`
        LEFT JOIN sexo s              ON s.`id_sexo`             = a.`id_sexo`
        LEFT JOIN tipos_documentos td ON td.`id_tipo_documento`  = a.`id_tipo_documento`
        LEFT JOIN familias f          ON f.`id_familia`          = a.`id_familia`
        /**WHERE**/
        ORDER BY a.id_alumno ASC
    ";

    $where  = array();
    $params = array();

    // Por defecto: solo activos
    $where[] = "a.activo = 1";

    if ($id > 0) {
        $where[] = "a.id_alumno = :id";
        $params[':id'] = $id;
    } elseif ($q !== '') {
        // Búsqueda por Apellido + Nombre (como lo tenías)
        $where[] = "CONCAT_WS(' ', a.apellido, a.nombre) LIKE :q";
        $params[':q'] = "%" . $q . "%";
    }

    if (!empty($where)) {
        $sql = str_replace('/**WHERE**/', 'WHERE ' . implode(' AND ', $where), $sql);
    } else {
        $sql = str_replace('/**WHERE**/', '', $sql);
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $alumnos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Normalización defensiva (por si hay NULL)
    if (is_array($alumnos)) {
        foreach ($alumnos as &$a) {
            if (!isset($a['es_cobrador'])) $a['es_cobrador'] = 0;
            $a['es_cobrador'] = (int)$a['es_cobrador'];
        }
        unset($a);
    }

    http_response_code(200);
    echo json_encode(array(
        'exito' => true,
        'alumnos' => $alumnos,
    ), JSON_UNESCAPED_UNICODE);
    exit;

} catch (Throwable $e) {
    // Si preferís 500, cambiá a: http_response_code(500);
    http_response_code(200);
    echo json_encode(array(
        'exito' => false,
        'mensaje' => 'Error al obtener los alumnos: ' . $e->getMessage(),
    ), JSON_UNESCAPED_UNICODE);
    exit;
}