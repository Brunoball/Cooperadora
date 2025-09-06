<?php
// backend/modules/alumnos/obtener_alumnos.php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/db.php'; // Debe exponer $pdo (PDO)

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    // Charset
    $pdo->exec("SET NAMES utf8mb4");

    /* ===========================
       Parámetros opcionales
       =========================== */
    $q  = isset($_GET['q'])  ? trim((string)$_GET['q']) : '';
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    /* ============================================================
       NOTA sobre nombres con ñ (id_año / nombre_año):
       Si tus tablas usan "anio" en lugar de "año", cambiá:
         - `id_año` por `id_anio`
         - `nombre_año` por `nombre_anio`
       y lo mismo en los JOIN/SELECT.
       ============================================================ */

    // SELECT con todos los campos que consume el frontend
    // num_documento -> alias dni (compat)
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
            a.activo,
            a.motivo,
            a.ingreso,
            a.observaciones,

            -- Nombres ya resueltos para UI
            an.`nombre_año`      AS anio_nombre,
            d.`nombre_division`  AS division_nombre,
            c.`nombre_categoria` AS categoria_nombre,

            -- NUEVO: resolver sexo y tipo de documento
            s.`sexo`             AS sexo_nombre,
            td.`descripcion`     AS tipo_documento_nombre,
            td.`sigla`           AS tipo_documento_sigla

        FROM alumnos a
        LEFT JOIN anio an           ON an.`id_año`       = a.`id_año`
        LEFT JOIN division d        ON d.`id_division`   = a.`id_division`
        LEFT JOIN categoria c       ON c.`id_categoria`  = a.`id_categoria`
        LEFT JOIN sexo s            ON s.`id_sexo`       = a.`id_sexo`
        LEFT JOIN tipos_documentos td
                                    ON td.`id_tipo_documento` = a.`id_tipo_documento`
        /**WHERE**/
        ORDER BY a.id_alumno ASC
    ";

    $where  = [];
    $params = [];

    // Solo activos (la grilla principal suele mostrar activos)
    $where[] = "a.activo = 1";

    if ($id > 0) {
        $where[]        = "a.id_alumno = :id";
        $params[':id']  = $id;
    } elseif ($q !== '') {
        // Busca por Apellido + Nombre (case-insensitive por collation)
        $where[]        = "CONCAT_WS(' ', a.apellido, a.nombre) LIKE :q";
        $params[':q']   = "%{$q}%";
    }

    // Inyectar WHERE (si corresponde)
    if (!empty($where)) {
        $sql = str_replace('/**WHERE**/', 'WHERE ' . implode(' AND ', $where), $sql);
    } else {
        $sql = str_replace('/**WHERE**/', '', $sql);
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $alumnos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'exito'   => true,
        'alumnos' => $alumnos,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al obtener los alumnos: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
