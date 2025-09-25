<?php
// backend/modules/cuotas/obtener_info_familia.php
declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');
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

    // 1) Buscar id_familia del alumno
    $stmt = $pdo->prepare("
        SELECT id_familia
        FROM alumnos
        WHERE id_alumno = :id
        LIMIT 1
    ");
    $stmt->execute([':id' => $idAlumno]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row || empty($row['id_familia'])) {
        echo json_encode([
            'exito' => true,
            'tiene_familia' => false,
            'id_familia' => null,
            'nombre_familia' => '',
            'miembros_total' => 0,
            'miembros_activos' => 0,
            'miembros' => []
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $idFamilia = (int)$row['id_familia'];

    // 2) Obtener nombre de la familia
    $stmt = $pdo->prepare("SELECT nombre_familia FROM familias WHERE id_familia = :idf LIMIT 1");
    $stmt->execute([':idf' => $idFamilia]);
    $fam = $stmt->fetch(PDO::FETCH_ASSOC);
    $nombreFamilia = $fam ? (string)($fam['nombre_familia'] ?? '') : '';

    // 3) Contar miembros (totales y activos)
    $stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM alumnos WHERE id_familia = :idf");
    $stmt->execute([':idf' => $idFamilia]);
    $tot = (int)($stmt->fetchColumn() ?: 0);

    $stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM alumnos WHERE id_familia = :idf AND activo = 1");
    $stmt->execute([':idf' => $idFamilia]);
    $act = (int)($stmt->fetchColumn() ?: 0);

    // 4) Listado de miembros (id, apellido, nombre, activo)
    $stmt = $pdo->prepare("
        SELECT id_alumno, apellido, nombre, activo
        FROM alumnos
        WHERE id_familia = :idf
        ORDER BY apellido ASC, nombre ASC
    ");
    $stmt->execute([':idf' => $idFamilia]);
    $miembros = [];
    while ($m = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $miembros[] = [
            'id_alumno' => (int)$m['id_alumno'],
            'apellido'  => (string)($m['apellido'] ?? ''),
            'nombre'    => (string)($m['nombre'] ?? ''),
            'activo'    => (int)($m['activo'] ?? 0) == 1
        ];
    }

    echo json_encode([
        'exito' => true,
        'tiene_familia' => true,
        'id_familia' => $idFamilia,
        'nombre_familia' => $nombreFamilia,
        'miembros_total' => $tot,
        'miembros_activos' => $act,
        'miembros' => $miembros
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
