<?php
// modules/alumnos/editar_alumno.php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

function aMayus($v) {
    return (isset($v) && $v !== '') ? mb_strtoupper(trim($v), 'UTF-8') : null;
}

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $id = $_GET['id'] ?? null;
        if (!$id) {
            echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado']);
            exit;
        }

        // NOTA: alias id_año -> id_anio
        $sql = "SELECT 
                    id_alumno,
                    apellido_nombre,
                    dni,
                    domicilio,
                    localidad,
                    telefono,
                    `id_año` AS id_anio,
                    id_division,
                    id_categoria
                FROM alumnos
                WHERE id_alumno = ?";
        $st = $pdo->prepare($sql);
        $st->execute([$id]);
        $alumno = $st->fetch(PDO::FETCH_ASSOC);

        if ($alumno) {
            echo json_encode(['exito' => true, 'alumno' => $alumno]);
        } else {
            echo json_encode(['exito' => false, 'mensaje' => 'Alumno no encontrado']);
        }
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents("php://input");
        $data = json_decode($raw, true) ?: [];

        $id = $data['id_alumno'] ?? null;
        if (!$id) {
            echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado']);
            exit;
        }

        // Campos recibidos desde el frontend
        $campos = [
            'apellido_nombre', 'dni', 'domicilio', 'localidad', 'telefono',
            'id_anio', 'id_division', 'id_categoria'
        ];

        $set = [];
        $val = [];

        foreach ($campos as $c) {
            $v = $data[$c] ?? null;

            // Vacíos => null
            if ($v === '') $v = null;

            // Uppercase para texto
            if (in_array($c, ['apellido_nombre', 'domicilio', 'localidad'])) {
                $v = aMayus($v);
            }

            // Mapeo del nombre lógico a la columna real (con ñ)
            if ($c === 'id_anio') {
                $set[] = "`id_año` = ?";
            } else {
                $set[] = "$c = ?";
            }

            $val[] = $v;
        }

        $val[] = $id;

        $sql = "UPDATE alumnos SET " . implode(', ', $set) . " WHERE id_alumno = ?";
        $st = $pdo->prepare($sql);
        $st->execute($val);

        echo json_encode(['exito' => true, 'mensaje' => 'ALUMNO ACTUALIZADO CORRECTAMENTE']);
        exit;
    }

    echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()]);
}
