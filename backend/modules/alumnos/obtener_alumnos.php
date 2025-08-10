<?php
// backend/modules/alumnos/obtener_alumnos.php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/db.php'; // Debe definir $pdo (PDO)

try {
    // Forzar excepciones en PDO
    if ($pdo instanceof PDO) {
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        // Opcional: asegurar charset
        $pdo->exec("SET NAMES utf8mb4");
    } else {
        throw new RuntimeException('Conexión PDO no disponible.');
    }

    // Filtros opcionales (?q=texto | ?id=123)
    $q  = isset($_GET['q'])  ? trim((string)$_GET['q']) : '';
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    // Consulta base
    // Si tu DB no usa "ñ" en los nombres, reemplazá `id_año` por id_anio y `nombre_año` por nombre_anio.
    $sql = "
        SELECT
            a.id_alumno,
            a.apellido_nombre      AS nombre,
            a.dni,
            a.domicilio,
            a.localidad,
            a.telefono,
            a.`id_año`,
            a.`id_division`,
            a.`id_categoria`,
            an.`nombre_año`        AS anio_nombre,
            d.`nombre_division`    AS division_nombre,
            c.`nombre_categoria`   AS categoria_nombre
        FROM alumnos a
        LEFT JOIN anio an      ON an.`id_año`      = a.`id_año`
        LEFT JOIN division d   ON d.`id_division`  = a.`id_division`
        LEFT JOIN categoria c  ON c.`id_categoria` = a.`id_categoria`
        /**WHERE**/
        ORDER BY a.id_alumno ASC
    ";

    $where  = [];
    $params = [];

    // 🔒 Siempre traer solo activos
    $where[] = "a.activo = 1";

    if ($id > 0) {
        $where[]       = "a.id_alumno = :id";
        $params[':id'] = $id;
    } elseif ($q !== '') {
        $where[]       = "a.apellido_nombre LIKE :q";
        $params[':q']  = "%{$q}%";
    }

    // Armar WHERE final
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
        'alumnos' => $alumnos
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al obtener los alumnos: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
