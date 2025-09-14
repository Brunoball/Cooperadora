<?php
// public_html/COOPERADORA/api/modules/contable/contable_egresos_upload.php
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', 0);
date_default_timezone_set('America/Argentina/Cordoba');

try {
    // __DIR__ = .../api/modules/contable
    // subimos 2 niveles => .../api
    $apiDir = dirname(__DIR__, 2);

    // Carpeta real donde se guardan los archivos
    $uploadsDir = $apiDir . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'egresos';
    // Ruta pública relativa correcta (incluye /api/)
    $uploadsRel = 'api/uploads/egresos';

    if (!is_dir($uploadsDir)) {
        if (!mkdir($uploadsDir, 0755, true)) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'mensaje' => 'No se pudo crear la carpeta de uploads']);
            exit;
        }
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'mensaje' => 'Método no permitido']);
        exit;
    }

    if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'No se recibió archivo']);
        exit;
    }

    $file = $_FILES['file'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'Error al subir el archivo (código ' . $file['error'] . ')']);
        exit;
    }

    // Tamaño máx 10 MB
    $maxBytes = 10 * 1024 * 1024;
    if ($file['size'] > $maxBytes) {
        http_response_code(413);
        echo json_encode(['ok' => false, 'mensaje' => 'El archivo supera 10MB']);
        exit;
    }

    // Detección de tipo robusta
    $mime = null;
    if (function_exists('finfo_open')) {
        $f = finfo_open(FILEINFO_MIME_TYPE);
        if ($f) {
            $mime = finfo_file($f, $file['tmp_name']);
            finfo_close($f);
        }
    }
    if (!$mime) {
        $extFromName = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $map = [
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png'  => 'image/png',
            'gif'  => 'image/gif',
            'webp' => 'image/webp',
            'pdf'  => 'application/pdf',
        ];
        $mime = $map[$extFromName] ?? 'application/octet-stream';
    }

    $permitidos = [
        'image/jpeg'      => 'jpg',
        'image/png'       => 'png',
        'image/gif'       => 'gif',
        'image/webp'      => 'webp',
        'application/pdf' => 'pdf',
    ];

    if (!isset($permitidos[$mime])) {
        http_response_code(415);
        echo json_encode(['ok' => false, 'mensaje' => 'Tipo de archivo no permitido (' . $mime . ')']);
        exit;
    }

    $ext = $permitidos[$mime];

    // Nombre único
    $slug     = bin2hex(random_bytes(8));
    $fecha    = date('Ymd_His');
    $filename = "egreso_{$fecha}_{$slug}.{$ext}";
    $destPath = $uploadsDir . DIRECTORY_SEPARATOR . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'mensaje' => 'No se pudo mover el archivo']);
        exit;
    }

    // URL pública correcta
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST']; // cooperadora.ipet50.edu.ar
    $publicRelUrl = $uploadsRel . '/' . $filename;                  // api/uploads/egresos/xxx
    $absoluteUrl  = $scheme . '://' . $host . '/' . $publicRelUrl;  // https://cooperadora.ipet50.edu.ar/api/uploads/egresos/xxx

    echo json_encode([
        'ok'           => true,
        'filename'     => $filename,
        'relative_url' => $publicRelUrl,
        'absolute_url' => $absoluteUrl,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log('[contable_egresos_upload] ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'mensaje' => 'Error interno en uploader']);
}
