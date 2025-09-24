<?php
// backend/modules/cuotas/meses_pagados.php
require_once __DIR__ . '/../../config/db.php';

// CORS (ajustá el origin si hace falta)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header("Vary: Origin");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

// Validación básica
$id_alumno = isset($_GET['id_alumno']) ? (int)$_GET['id_alumno'] : 0;
$anio      = isset($_GET['anio']) ? (int)$_GET['anio'] : (int)date('Y');
if ($anio < 2000 || $anio > 2100) $anio = (int)date('Y');

if ($id_alumno <= 0) {
    echo json_encode(['exito' => false, 'mensaje' => 'id_alumno inválido'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // === PDO ===
    if (isset($pdo) && $pdo instanceof PDO) {
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Sólo tabla 'pagos' (sin prefijo de base)
        $sql = "
            SELECT p.id_mes, p.estado
              FROM pagos p
             WHERE p.id_alumno = :id_alumno
               AND YEAR(p.fecha_pago) = :anio
        ";
        $st = $pdo->prepare($sql);
        $st->execute([
            ':id_alumno' => $id_alumno,
            ':anio'      => $anio
        ]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);

        $detalles = [];
        $ids = [];
        foreach ($rows as $r) {
            $id_mes = (int)$r['id_mes'];
            $estado = isset($r['estado']) ? strtolower((string)$r['estado']) : '';
            if ($id_mes >= 1 && $id_mes <= 12) {
                $ids[] = $id_mes;
                $detalles[] = [
                    'id_mes' => $id_mes,
                    'estado' => $estado ?: 'pagado' // fallback
                ];
            }
        }

        // (Opcional) fecha de ingreso del alumno — sólo tabla 'alumnos'
        $ingreso = null;
        // try {
        //     $st2 = $pdo->prepare("SELECT fecha_ingreso FROM alumnos WHERE id = :id LIMIT 1");
        //     $st2->execute([':id' => $id_alumno]);
        //     $ingreso = $st2->fetchColumn() ?: null;
        // } catch (Throwable $e) {}

        echo json_encode([
            'exito'          => true,
            'meses_pagados'  => array_values(array_unique($ids)), // compat con frontend viejo
            'detalles'       => $detalles,                        // estado por mes
            'ingreso'        => $ingreso
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // === mysqli (fallback) ===
    if (isset($conn) && $conn instanceof mysqli) {
        $sql = "SELECT id_mes, estado FROM pagos WHERE id_alumno = ? AND YEAR(fecha_pago) = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param('ii', $id_alumno, $anio);
        $stmt->execute();
        $result = $stmt->get_result();

        $detalles = [];
        $ids = [];
        while ($r = $result->fetch_assoc()) {
            $id_mes = (int)$r['id_mes'];
            $estado = isset($r['estado']) ? strtolower((string)$r['estado']) : '';
            if ($id_mes >= 1 && $id_mes <= 12) {
                $ids[] = $id_mes;
                $detalles[] = [
                    'id_mes' => $id_mes,
                    'estado' => $estado ?: 'pagado'
                ];
            }
        }
        $stmt->close();

        echo json_encode([
            'exito'          => true,
            'meses_pagados'  => array_values(array_unique($ids)),
            'detalles'       => $detalles,
            'ingreso'        => null
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['exito' => false, 'mensaje' => 'Conexión a BD no disponible'], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error interno', 'detalle' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
