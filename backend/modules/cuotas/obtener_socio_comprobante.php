<?php
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$id = $_GET['id'] ?? null;

if (!$id) {
    echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado']);
    exit;
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
            s.id_periodo,
            c.descripcion AS nombre_categoria,
            e.descripcion AS nombre_estado,
            cb.nombre AS nombre_cobrador,
            p.nombre AS nombre_periodo
        FROM socios s
        LEFT JOIN categoria c ON s.id_categoria = c.id_categoria
        LEFT JOIN estado e ON s.id_estado = e.id_estado
        LEFT JOIN cobrador cb ON s.id_cobrador = cb.id_cobrador
        LEFT JOIN periodo p ON s.id_periodo = p.id_periodo
        WHERE s.id_socio = ?
    ");
    $stmt->execute([$id]);
    $socio = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($socio) {
        $anio = date('Y');

        // Teléfono: prioriza móvil, luego fijo
        $telefono = '';
        if (!empty($socio['telefono_movil'])) {
            $telefono = trim($socio['telefono_movil']);
        } elseif (!empty($socio['telefono_fijo'])) {
            $telefono = trim($socio['telefono_fijo']);
        }

        // Periodo: nombre si existe, si no muestra ID / año
        $periodoTexto = '';
        if (!empty($socio['nombre_periodo'])) {
            $periodoTexto = $socio['nombre_periodo'];
        } elseif (!empty($socio['id_periodo'])) {
            $periodoTexto = "PERÍODO: {$socio['id_periodo']} / {$anio}";
        }

        echo json_encode([
            'exito' => true,
            'socio' => [
                'id_socio' => $socio['id_socio'] ?? '',
                'nombre' => $socio['nombre'] ?? '',
                'domicilio' => $socio['domicilio'] ?? '',
                'numero' => $socio['numero'] ?? '',
                'domicilio_cobro' => trim($socio['domicilio_cobro'] ?? ''),
                'telefono' => $telefono,
                'mes' => $periodoTexto,
                'nombre_categoria' => $socio['nombre_categoria'] ?? '',
                'precio_categoria' => '4000', // valor fijo
                'nombre_estado' => $socio['nombre_estado'] ?? '',
                'nombre_cobrador' => $socio['nombre_cobrador'] ?? ''
            ]
        ]);
    } else {
        echo json_encode(['exito' => false, 'mensaje' => 'Socio no encontrado']);
    }
} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error de servidor: ' . $e->getMessage()]);
}
