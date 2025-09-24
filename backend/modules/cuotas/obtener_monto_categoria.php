<?php
// backend/modules/cuotas/obtener_monto_categoria.php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

// CORS básico (opcional). Quitá si no lo necesitás.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido. Usá GET.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $idAlumno = isset($_GET['id_alumno']) ? (int)$_GET['id_alumno'] : 0;
    if ($idAlumno <= 0) {
        http_response_code(400);
        echo json_encode(['exito' => false, 'mensaje' => 'Parámetro id_alumno inválido.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // 1) Traer datos mínimos del alumno (SOLO tabla 'alumnos')
    $stmt = $pdo->prepare("
        SELECT a.id_alumno, a.id_categoria, a.id_cat_monto
        FROM alumnos a
        WHERE a.id_alumno = :id
        LIMIT 1
    ");
    $stmt->execute([':id' => $idAlumno]);
    $alumno = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$alumno) {
        http_response_code(404);
        echo json_encode(['exito' => false, 'mensaje' => 'Alumno no encontrado.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $idCategoria = isset($alumno['id_categoria']) ? (int)$alumno['id_categoria'] : null;
    $idCatMonto  = isset($alumno['id_cat_monto']) ? (int)$alumno['id_cat_monto'] : null;

    $payload = [
        'exito'            => true,
        'id_categoria'     => $idCategoria,
        'categoria_nombre' => '',
        'monto_mensual'    => 0,
        'monto_anual'      => 0,
        'monto_matricula'  => 0,
        'fuente'           => null,
    ];

    // ---- MATRÍCULA (id 14) desde SOLO tabla 'meses' ----
    $stmtMat = $pdo->prepare("SELECT monto FROM meses WHERE id_mes = 14 LIMIT 1");
    $stmtMat->execute();
    $rowMat = $stmtMat->fetch(PDO::FETCH_ASSOC);
    if ($rowMat && isset($rowMat['monto'])) {
        $payload['monto_matricula'] = (int)$rowMat['monto'];
    } else {
        // Valor por defecto opcional
        $payload['monto_matricula'] = 15000;
    }

    // 2) Prioridad: categoria_monto (registro específico asignado al alumno)
    if (!empty($idCatMonto)) {
        $stmt = $pdo->prepare("
            SELECT
                cm.id_cat_monto,
                cm.nombre_categoria AS categoria_nombre,
                cm.monto_mensual   AS monto_mensual,
                cm.monto_anual     AS monto_anual
            FROM categoria_monto cm
            WHERE cm.id_cat_monto = :idcm
            LIMIT 1
        ");
        $stmt->execute([':idcm' => $idCatMonto]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            $payload['categoria_nombre'] = (string)($row['categoria_nombre'] ?? '');
            $payload['monto_mensual']    = (int)($row['monto_mensual'] ?? 0);
            $payload['monto_anual']      = (int)($row['monto_anual'] ?? 0);
            $payload['fuente']           = 'categoria_monto';

            echo json_encode($payload, JSON_UNESCAPED_UNICODE);
            exit;
        }
        // Si no encontró en categoria_monto, continúa al fallback por categoria
    }

    // 3) Fallback: tabla categoria (singular) usando id_categoria del alumno
    if (!empty($idCategoria)) {
        $stmt = $pdo->prepare("
            SELECT
                c.id_categoria,
                COALESCE(c.nombre_categoria, c.descripcion, c.nombre) AS categoria_nombre,
                COALESCE(c.monto, c.Precio_Categoria, 0)              AS monto_mensual
            FROM categoria c
            WHERE c.id_categoria = :idc
            LIMIT 1
        ");
        $stmt->execute([':idc' => $idCategoria]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            $payload['id_categoria']     = (int)$row['id_categoria'];
            $payload['categoria_nombre'] = (string)($row['categoria_nombre'] ?? '');
            $payload['monto_mensual']    = (int)($row['monto_mensual'] ?? 0);
            $payload['fuente']           = 'categoria';

            echo json_encode($payload, JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    // 4) Último fallback si no hay montos
    $payload['exito']   = false;
    $payload['mensaje'] = 'No se encontró monto/categoría para el alumno.';
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
