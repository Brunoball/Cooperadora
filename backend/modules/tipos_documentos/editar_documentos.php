<?php
// backend/modules/tipos_documentos/editar_documentos.php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    if (!($pdo instanceof PDO)) throw new RuntimeException('Conexión no disponible.');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('SET NAMES utf8mb4');

    $id = (int)($_POST['id'] ?? 0);
    $descripcion = trim((string)($_POST['descripcion'] ?? ''));
    $sigla = strtoupper(trim((string)($_POST['sigla'] ?? '')));

    if ($id <= 0) throw new InvalidArgumentException('ID inválido.');
    if ($descripcion === '' || $sigla === '') {
        throw new InvalidArgumentException('Descripción y sigla son obligatorias.');
    }
    if (strlen($descripcion) > 100) {
        throw new InvalidArgumentException('La descripción no puede superar 100 caracteres.');
    }
    if (strlen($sigla) > 10) {
        throw new InvalidArgumentException('La sigla no puede superar 10 caracteres.');
    }

    $stC = $pdo->prepare(
        "SELECT COUNT(*)
         FROM tipos_documentos
         WHERE (descripcion = :d OR sigla = :s) AND id_tipo_documento <> :id"
    );
    $stC->execute([':d' => $descripcion, ':s' => $sigla, ':id' => $id]);
    if ((int)$stC->fetchColumn() > 0) {
        throw new RuntimeException('Ya existe otro tipo con esa descripción o sigla.');
    }

    $st = $pdo->prepare(
        "UPDATE tipos_documentos
         SET descripcion = :d, sigla = :s
         WHERE id_tipo_documento = :id"
    );
    $st->execute([':d' => $descripcion, ':s' => $sigla, ':id' => $id]);

    echo json_encode(['exito' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode(['exito' => false, 'mensaje' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
