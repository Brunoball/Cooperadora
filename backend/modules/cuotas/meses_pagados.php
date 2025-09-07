<?php
// modules/pagos/periodos_pagados.php
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Acepto id_alumno o id_socio por compatibilidad
    $idAlumno = 0;
    if (isset($_GET['id_alumno'])) $idAlumno = (int) $_GET['id_alumno'];
    if (!$idAlumno && isset($_GET['id_socio'])) $idAlumno = (int) $_GET['id_socio'];

    // Año a consultar (default: año actual). Valido rango razonable.
    $anio = isset($_GET['anio']) ? (int) $_GET['anio'] : (int) date('Y');
    if ($anio < 2000 || $anio > 2100) {
        $anio = (int) date('Y');
    }

    if ($idAlumno <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID de alumno inválido'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ── Fecha de ingreso (si existe la columna). Intento varios nombres comunes.
    $ingreso = null;
    try {
        $qIngreso = $pdo->prepare("
            SELECT 
                COALESCE(fecha_ingreso, ingreso, fecha_alta) AS f
            FROM alumnos
            WHERE id_alumno = :id
            LIMIT 1
        ");
        $qIngreso->execute([':id' => $idAlumno]);
        $val = $qIngreso->fetchColumn();
        if ($val) $ingreso = (string) $val;
    } catch (Throwable $e) {
        // ignorar si tu tabla/columna difiere; no es crítico
    }

    // ── Meses registrados para el AÑO solicitado (pagados o condonados)
    $stmt = $pdo->prepare("
        SELECT id_mes, estado, fecha_pago
          FROM pagos
         WHERE id_alumno = :id_alumno
           AND YEAR(fecha_pago) = :anio
           AND estado IN ('pagado','condonado')
         ORDER BY id_mes ASC
    ");
    $stmt->execute([
        ':id_alumno' => $idAlumno,
        ':anio'      => $anio,
    ]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Armo respuesta
    $periodosIds = [];
    $detalle     = [];
    foreach ($rows as $r) {
        $periodosIds[] = (int) $r['id_mes'];
        $detalle[] = [
            'id_mes'     => (int) $r['id_mes'],
            'estado'     => (string) $r['estado'],
            'fecha_pago' => (string) $r['fecha_pago'],
        ];
    }

    echo json_encode([
        'exito'             => true,
        'id_alumno'         => $idAlumno,
        'anio'              => $anio,
        'periodos_pagados'  => $periodosIds,  // <- tu modal usa este array para pintar "Pagado"
        'detalle'           => $detalle,      // opcional, por si luego querés mostrar "Condonado"
        'ingreso'           => $igreso ?? $ingreso
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al obtener períodos pagados: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
