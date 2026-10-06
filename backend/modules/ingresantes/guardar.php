<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido.'], JSON_UNESCAPED_UNICODE);
    exit;
}

require_once __DIR__ . '/../../config/db.php';

try {
    if (!isset($pdo) || !($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");
    $pdo->exec("SET time_zone = '-03:00'");

    $data = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($data)) {
        echo json_encode(['exito' => false, 'mensaje' => 'Datos no válidos.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $id = isset($data['id_ingresante']) && $data['id_ingresante'] !== ''
        ? (int)$data['id_ingresante']
        : 0;

    $upper = static function ($value, int $max): string {
        $text = mb_strtoupper(trim((string)$value), 'UTF-8');
        return mb_substr($text, 0, $max, 'UTF-8');
    };

    $apellido = $upper($data['apellido'] ?? '', 100);
    $nombre = $upper($data['nombre'] ?? '', 100);
    $dni = preg_replace('/\D+/', '', (string)($data['dni'] ?? ''));
    $anioIngreso = (int)($data['anio_ingreso'] ?? 0);
    $cicloLectivo = (int)($data['ciclo_lectivo'] ?? 2027);
    $matriculaPagada = !empty($data['matricula_pagada']) ? 1 : 0;
    $observaciones = trim((string)($data['observaciones'] ?? ''));
    if ($observaciones !== '') {
        $observaciones = mb_substr($observaciones, 0, 255, 'UTF-8');
    } else {
        $observaciones = null;
    }

    $montoInput = $data['monto_matricula'] ?? null;
    if ($montoInput === null || $montoInput === '') {
        $montoStmt = $pdo->query("SELECT monto FROM meses WHERE id_mes = 14 LIMIT 1");
        $monto = $montoStmt ? (int)($montoStmt->fetchColumn() ?: 0) : 0;
    } else {
        $monto = (int)preg_replace('/\D+/', '', (string)$montoInput);
    }

    $errores = [];
    if ($apellido === '' || !preg_match("/^[\\p{L} .'-]+$/u", $apellido)) {
        $errores['apellido'] = 'Ingresá un apellido válido.';
    }
    if ($nombre === '' || !preg_match("/^[\\p{L} .'-]+$/u", $nombre)) {
        $errores['nombre'] = 'Ingresá un nombre válido.';
    }
    if ($dni === '' || strlen($dni) < 6 || strlen($dni) > 20) {
        $errores['dni'] = 'Ingresá un DNI válido.';
    }
    if (!in_array($anioIngreso, [1, 2], true)) {
        $errores['anio_ingreso'] = 'El ingresante debe entrar a 1° o 2° año.';
    }
    if ($cicloLectivo < 2020 || $cicloLectivo > 2100) {
        $errores['ciclo_lectivo'] = 'Ciclo lectivo inválido.';
    }
    if ($monto < 0) {
        $errores['monto_matricula'] = 'El monto no puede ser negativo.';
    }
    if ($matriculaPagada === 0) {
        $monto = 0;
    }

    if ($errores) {
        echo json_encode([
            'exito' => false,
            'mensaje' => 'Revisá los datos ingresados.',
            'errores' => $errores,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($id > 0) {
        $sql = "UPDATE ingresantes
                   SET apellido = :apellido,
                       nombre = :nombre,
                       dni = :dni,
                       anio_ingreso = :anio_ingreso,
                       ciclo_lectivo = :ciclo_lectivo,
                       matricula_pagada = :matricula_pagada,
                       monto_matricula = :monto_matricula,
                       observaciones = :observaciones
                 WHERE id_ingresante = :id";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':apellido' => $apellido,
            ':nombre' => $nombre,
            ':dni' => $dni,
            ':anio_ingreso' => $anioIngreso,
            ':ciclo_lectivo' => $cicloLectivo,
            ':matricula_pagada' => $matriculaPagada,
            ':monto_matricula' => $monto,
            ':observaciones' => $observaciones,
            ':id' => $id,
        ]);

        if ($stmt->rowCount() === 0) {
            $exists = $pdo->prepare("SELECT 1 FROM ingresantes WHERE id_ingresante = ? LIMIT 1");
            $exists->execute([$id]);
            if (!$exists->fetchColumn()) {
                echo json_encode(['exito' => false, 'mensaje' => 'El ingresante ya no existe.'], JSON_UNESCAPED_UNICODE);
                exit;
            }
        }

        echo json_encode([
            'exito' => true,
            'mensaje' => 'Ingresante actualizado correctamente.',
            'id_ingresante' => $id,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $sql = "INSERT INTO ingresantes
                (apellido, nombre, dni, anio_ingreso, ciclo_lectivo, matricula_pagada, monto_matricula, observaciones)
            VALUES
                (:apellido, :nombre, :dni, :anio_ingreso, :ciclo_lectivo, :matricula_pagada, :monto_matricula, :observaciones)";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':apellido' => $apellido,
        ':nombre' => $nombre,
        ':dni' => $dni,
        ':anio_ingreso' => $anioIngreso,
        ':ciclo_lectivo' => $cicloLectivo,
        ':matricula_pagada' => $matriculaPagada,
        ':monto_matricula' => $monto,
        ':observaciones' => $observaciones,
    ]);

    echo json_encode([
        'exito' => true,
        'mensaje' => 'Ingresante registrado correctamente.',
        'id_ingresante' => (int)$pdo->lastInsertId(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
} catch (PDOException $e) {
    if ($e->getCode() === '23000' && stripos($e->getMessage(), 'Duplicate') !== false) {
        echo json_encode([
            'exito' => false,
            'mensaje' => 'Ese DNI ya está registrado como ingresante para el ciclo indicado.',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    http_response_code(500);
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error al guardar el ingresante: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error al guardar el ingresante: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
