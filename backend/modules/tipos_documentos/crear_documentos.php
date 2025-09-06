<?php
// backend/modules/tipos_documentos/crear_documentos.php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    if (!($pdo instanceof PDO)) throw new RuntimeException('Conexión no disponible.');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    // FormData (no application/json)
    $descripcion = trim((string)($_POST['descripcion'] ?? ''));
    $sigla       = strtoupper(trim((string)($_POST['sigla'] ?? '')));

    if ($descripcion === '' || $sigla === '') {
        echo json_encode(['exito'=>false,'mensaje'=>'Descripción y sigla son obligatorias.']); exit;
    }
    if (mb_strlen($descripcion) > 100) {
        echo json_encode(['exito'=>false,'mensaje'=>'La descripción no puede superar 100 caracteres.']); exit;
    }
    if (mb_strlen($sigla) > 10) {
        echo json_encode(['exito'=>false,'mensaje'=>'La sigla no puede superar 10 caracteres.']); exit;
    }

    // Duplicados (case-insensitive)
    $stC = $pdo->prepare("
        SELECT 1 FROM tipos_documentos
        WHERE LOWER(descripcion) = LOWER(:d)
           OR UPPER(sigla)       = UPPER(:s)
        LIMIT 1
    ");
    $stC->execute([':d'=>$descripcion, ':s'=>$sigla]);
    if ($stC->fetchColumn()) {
        echo json_encode(['exito'=>false,'mensaje'=>'Ya existe un tipo con esa descripción o sigla.']); exit;
    }

    $st = $pdo->prepare("INSERT INTO tipos_documentos (descripcion, sigla) VALUES (:d,:s)");
    $st->execute([':d'=>$descripcion, ':s'=>$sigla]);

    echo json_encode(['exito'=>true, 'id'=>(int)$pdo->lastInsertId()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode(['exito'=>false,'mensaje'=>$e->getMessage()], JSON_UNESCAPED_UNICODE);
}
