<?php
// backend/modules/cuotas/obtener_monto_categoria.php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $idAlumno = isset($_GET['id_alumno']) ? (int)$_GET['id_alumno'] : 0;
    if ($idAlumno <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'Parámetro id_alumno inválido.']);
        exit;
    }

    // 1) Traer datos mínimos del alumno
    $stmt = $pdo->prepare("
        SELECT a.id_alumno, a.id_categoria, a.id_cat_monto
        FROM alumnos a
        WHERE a.id_alumno = :id
        LIMIT 1
    ");
    $stmt->execute([':id' => $idAlumno]);
    $alumno = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$alumno) {
        echo json_encode(['exito' => false, 'mensaje' => 'Alumno no encontrado.']);
        exit;
    }

    $idCategoria = isset($alumno['id_categoria']) ? (int)$alumno['id_categoria'] : null;
    $idCatMonto  = isset($alumno['id_cat_monto']) ? (int)$alumno['id_cat_monto'] : null;

    // 2) Prioridad: categoria_monto (registro específico asignado al alumno)
    if ($idCatMonto) {
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
            echo json_encode([
                'exito'            => true,
                // id_categoria proviene de alumnos (categoria_monto no lo tiene)
                'id_categoria'     => $idCategoria,
                'categoria_nombre' => (string)($row['categoria_nombre'] ?? ''),
                'monto_mensual'    => (int)($row['monto_mensual'] ?? 0),
                'monto_anual'      => (int)($row['monto_anual'] ?? 0),
                'fuente'           => 'categoria_monto'
            ]);
            exit;
        }
        // Si no encontró en categoria_monto, continúa al fallback por categoria
    }

    // 3) Fallback: tabla categoria (singular) usando id_categoria del alumno
    if ($idCategoria) {
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
            echo json_encode([
                'exito'            => true,
                'id_categoria'     => (int)$row['id_categoria'],
                'categoria_nombre' => (string)($row['categoria_nombre'] ?? ''),
                'monto_mensual'    => (int)($row['monto_mensual'] ?? 0),
                'fuente'           => 'categoria'
            ]);
            exit;
        }
    }

    // 4) Último fallback: no hay datos
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'No se encontró monto/categoría para el alumno.'
    ]);
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()]);
}
