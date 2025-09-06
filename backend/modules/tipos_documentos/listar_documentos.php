<?php
// backend/modules/tipos_documentos/listar_documentos.php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    if (!($pdo instanceof PDO)) throw new RuntimeException('Conexión no disponible.');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('SET NAMES utf8mb4');

    $sql = "SELECT id_tipo_documento AS id, descripcion, sigla
            FROM tipos_documentos
            ORDER BY descripcion";
    $st = $pdo->query($sql);
    $out = [];
    while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
        $out[] = [
            'id' => (int)$r['id'],
            'descripcion' => (string)$r['descripcion'],
            'sigla' => (string)$r['sigla'],
        ];
        // nota: no forzamos uppercase para que se vea tal cual guardado
    }

    echo json_encode(['exito' => true, 'tipos_documentos' => $out], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
