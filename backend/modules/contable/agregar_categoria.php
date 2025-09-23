<?php
// backend/modules/contable/agregar_categoria.php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido. Usá POST.']);
        exit;
    }

    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    $raw = json_decode(file_get_contents('php://input'), true) ?? [];
    $nombre = strtoupper(trim((string)($raw['nombre'] ?? '')));

    if ($nombre === '') {
        throw new RuntimeException('INGRESÁ LA NUEVA CATEGORÍA.');
    }
    if (mb_strlen($nombre) > 100) {
        throw new RuntimeException('LA CATEGORÍA NO PUEDE SUPERAR 100 CARACTERES.');
    }

    // Inserta o no-op si ya existe por UNIQUE
    $sql = "INSERT INTO `egreso_categoria` (`nombre_categoria`) VALUES (:n)
            ON DUPLICATE KEY UPDATE `nombre_categoria` = VALUES(`nombre_categoria`)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':n' => $nombre]);

    // Si ya existía, lastInsertId = 0; buscamos el id
    $id = (int)$pdo->lastInsertId();
    if ($id === 0) {
        $q = $pdo->prepare("SELECT `id_egreso_categoria` AS id
                            FROM `egreso_categoria`
                            WHERE `nombre_categoria` = :n
                            LIMIT 1");
        $q->execute([':n' => $nombre]);
        $id = (int)($q->fetchColumn() ?: 0);
    }

    if ($id <= 0) {
        throw new RuntimeException('No se pudo obtener el ID de la categoría.');
    }

    echo json_encode([
        'exito'  => true,
        'id'     => $id,
        'nombre' => $nombre,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(200); // mantener 200 para manejo uniforme en frontend
    echo json_encode([
        'exito'   => false,
        'mensaje' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
