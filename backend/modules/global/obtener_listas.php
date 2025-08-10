<?php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $listas = [
        'anios'       => [],
        'categorias'  => [],
        'divisiones'  => [],
    ];

    /* ----------- AÑOS ----------- */
    // usa backticks porque las columnas tienen ñ
    $sql = "SELECT `id_año` AS id, `nombre_año` AS nombre
            FROM `anio`
            ORDER BY `nombre_año`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['anios'][] = [
            'id'     => (int)$row['id'],
            'nombre' => $row['nombre'],
        ];
    }

    /* -------- CATEGORÍAS -------- */
    $sql = "SELECT `id_categoria` AS id, `nombre_categoria` AS nombre
            FROM `categoria`
            ORDER BY `nombre_categoria`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['categorias'][] = [
            'id'     => (int)$row['id'],
            'nombre' => $row['nombre'],
        ];
    }

    /* --------- DIVISIONES -------- */
    $sql = "SELECT `id_division` AS id, `nombre_division` AS nombre
            FROM `division`
            ORDER BY `nombre_division`";
    foreach ($pdo->query($sql, PDO::FETCH_ASSOC) as $row) {
        $listas['divisiones'][] = [
            'id'     => (int)$row['id'],
            'nombre' => $row['nombre'],
        ];
    }

    echo json_encode([
        'exito'  => true,
        'listas' => $listas,
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error en la base de datos: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
