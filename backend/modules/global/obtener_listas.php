<?php
// backend/modules/listas/obtener_listas.php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $listas = [
        'anios'       => [],
        'categorias'  => [],
        'divisiones'  => [],
        'meses'       => [],
    ];

    /* ----------- AÑOS ----------- */
    // Usa backticks por columnas con ñ
    $sql = "SELECT `id_año` AS id, `nombre_año` AS nombre
            FROM `anio`
            ORDER BY `nombre_año`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['anios'][] = [
            'id'     => (int)$row['id'],
            'nombre' => (string)$row['nombre'],
        ];
    }

    /* -------- CATEGORÍAS -------- */
    $sql = "SELECT `id_categoria` AS id, `nombre_categoria` AS nombre
            FROM `categoria`
            ORDER BY `nombre_categoria`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['categorias'][] = [
            'id'     => (int)$row['id'],
            'nombre' => (string)$row['nombre'],
        ];
    }

    /* --------- DIVISIONES -------- */
    $sql = "SELECT `id_division` AS id, `nombre_division` AS nombre
            FROM `division`
            ORDER BY `nombre_division`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['divisiones'][] = [
            'id'     => (int)$row['id'],
            'nombre' => (string)$row['nombre'],
        ];
    }

    /* ----------- MESES ----------- */
    // Tabla: cooperadora.meses (id_mes, nombre)
    // Si tu conexión ya usa la DB cooperadora no hace falta prefijar; si no, podés usar `cooperadora`.`meses`
    $sql = "SELECT `id_mes` AS id, `nombre`
            FROM `meses`
            ORDER BY `id_mes`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['meses'][] = [
            'id'     => (int)$row['id'],
            'nombre' => (string)$row['nombre'],
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
