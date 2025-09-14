<?php
// backend/modules/listas/obtener_listas.php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    $listas = [
        'anios'             => [],
        'categorias'        => [],
        'divisiones'        => [],
        'meses'             => [],
        'sexos'             => [],
        'tipos_documentos'  => [],
        'medios_pago'       => [],   // 👈 nuevo array para los medios de pago
    ];

    /* ----------- AÑOS ----------- */
    $sql = "SELECT `id_año` AS id, `nombre_año` AS nombre
            FROM `anio`
            ORDER BY `nombre_año`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['anios'][] = [
            'id'     => (int) $row['id'],
            'nombre' => (string) $row['nombre'],
        ];
    }

    /* -------- CATEGORÍAS -------- */
    $sql = "SELECT `id_categoria` AS id, `nombre_categoria` AS nombre
            FROM `categoria`
            ORDER BY `nombre_categoria`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['categorias'][] = [
            'id'     => (int) $row['id'],
            'nombre' => (string) $row['nombre'],
        ];
    }

    /* --------- DIVISIONES -------- */
    $sql = "SELECT `id_division` AS id, `nombre_division` AS nombre
            FROM `division`
            ORDER BY `nombre_division`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['divisiones'][] = [
            'id'     => (int) $row['id'],
            'nombre' => (string) $row['nombre'],
        ];
    }

    /* ----------- MESES ----------- */
    $sql = "SELECT `id_mes` AS id, `nombre`
            FROM `meses`
            ORDER BY `id_mes`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['meses'][] = [
            'id'     => (int) $row['id'],
            'nombre' => (string) $row['nombre'],
        ];
    }

    /* ------------ SEXO ------------ */
    $sql = "SELECT `id_sexo` AS id, `sexo`
            FROM `sexo`
            ORDER BY `sexo`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['sexos'][] = [
            'id'   => (int) $row['id'],
            'sexo' => (string) $row['sexo'],
        ];
    }

    /* ----- TIPOS DE DOCUMENTOS ----- */
    $sql = "SELECT `id_tipo_documento` AS id, `descripcion`, `sigla`
            FROM `tipos_documentos`
            ORDER BY `descripcion`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['tipos_documentos'][] = [
            'id'          => (int) $row['id'],
            'descripcion' => (string) $row['descripcion'],
            'sigla'       => (string) $row['sigla'],
        ];
    }

    /* ----- MEDIOS DE PAGO ----- */
    // Tabla: medio_pago (id_medio_pago, medio_pago)
    $sql = "SELECT `id_medio_pago` AS id, `medio_pago` AS nombre
            FROM `medio_pago`
            ORDER BY `medio_pago`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['medios_pago'][] = [
            'id'     => (int) $row['id'],
            'nombre' => (string) $row['nombre'],
        ];
    }

    echo json_encode([
        'exito'  => true,
        'listas' => $listas,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
