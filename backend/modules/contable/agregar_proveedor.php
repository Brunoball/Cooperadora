<?php
// backend/modules/contable/agregar_proveedor.php
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
        throw new RuntimeException('INGRESÁ EL NOMBRE DEL PROVEEDOR.');
    }
    if (mb_strlen($nombre) > 120) {
        throw new RuntimeException('EL PROVEEDOR NO PUEDE SUPERAR 120 CARACTERES.');
    }

    // Asegurar UNIQUE por nombre (si ya existe será no-op)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS contable_proveedor (
            id_cont_proveedor INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            nombre_proveedor  VARCHAR(120) NOT NULL,
            fecha_creacion    DATE NOT NULL DEFAULT (CURRENT_DATE),
            UNIQUE KEY uq_contable_proveedor_nombre (nombre_proveedor)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    $sql = "INSERT INTO contable_proveedor (nombre_proveedor)
            VALUES (:n)
            ON DUPLICATE KEY UPDATE nombre_proveedor = VALUES(nombre_proveedor)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':n' => $nombre]);

    // Si ya existía, lastInsertId() = '0'; buscar su id
    $id = (int)$pdo->lastInsertId();
    if ($id === 0) {
        $q = $pdo->prepare("SELECT id_cont_proveedor FROM contable_proveedor WHERE nombre_proveedor = :n LIMIT 1");
        $q->execute([':n' => $nombre]);
        $id = (int)($q->fetchColumn() ?: 0);
    }

    if ($id <= 0) {
        throw new RuntimeException('No se pudo obtener el ID del proveedor.');
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
