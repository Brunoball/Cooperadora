<?php
require_once(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json');

$id_socio = $_GET['id_socio'] ?? '';
$id_periodo = $_GET['id_periodo'] ?? '';

if (!$id_socio || !$id_periodo) {
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Faltan datos del código (socio o período)'
    ]);
    exit;
}

// Función auxiliar: convierte id_periodo a último mes del período
function obtenerUltimoMesDePeriodo($id_periodo) {
    $mapa = [
        1 => 2,  // febrero
        2 => 4,  // abril
        3 => 6,  // junio
        4 => 8,  // agosto
        5 => 10, // octubre
        6 => 12  // diciembre
    ];
    return $mapa[$id_periodo] ?? 0;
}

try {
    $stmt = $pdo->prepare("
        SELECT 
            s.id_socio,
            s.nombre,
            s.domicilio,
            s.numero,
            s.telefono_movil,
            s.telefono_fijo,
            s.domicilio_cobro,
            s.dni,
            s.id_categoria,
            s.ingreso,
            cat.descripcion AS categoria
        FROM socios s
        JOIN categoria cat ON s.id_categoria = cat.id_categoria
        WHERE s.id_socio = :id_socio
          AND s.activo = 1
        LIMIT 1
    ");
    $stmt->bindParam(':id_socio', $id_socio, PDO::PARAM_INT);
    $stmt->execute();
    $socio = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($socio) {
        $fechaIngreso = $socio['ingreso'];

        $ultimoMesDelPeriodo = obtenerUltimoMesDePeriodo((int)$id_periodo);
        $anioActual = (int)date('Y');

        // Si tiene fecha válida y es del año actual, validar el mes
        if ($fechaIngreso && $fechaIngreso !== '0000-00-00') {
            $anioIngreso = (int)date('Y', strtotime($fechaIngreso));
            $mesIngreso = (int)date('n', strtotime($fechaIngreso));

            if ($anioIngreso === $anioActual && $mesIngreso > $ultimoMesDelPeriodo) {
                echo json_encode([
                    'exito' => false,
                    'mensaje' => "⛔ El socio {$socio['nombre']} aún no estaba registrado en ese período"
                ]);
                exit;
            }
        }

        $socio['domicilio_completo'] = trim(($socio['domicilio'] ?? '') . ' ' . ($socio['numero'] ?? ''));
        $socio['telefono'] = $socio['telefono_movil'] ?: ($socio['telefono_fijo'] ?? '');
        $socio['monto'] = 4000;

        echo json_encode(['exito' => true, 'socio' => $socio]);
    } else {
        echo json_encode(['exito' => false, 'mensaje' => 'No se encontró ningún socio activo con ese ID']);
    }
} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error SQL: ' . $e->getMessage()]);
}
