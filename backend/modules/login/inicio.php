<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once(__DIR__ . '/../../config/db.php');

// Leer datos del frontend
$data = json_decode(file_get_contents("php://input"), true);
$nombre = trim($data['nombre'] ?? '');
$contrasena = $data['contrasena'] ?? '';

if (!$nombre || !$contrasena) {
    echo json_encode(['exito' => false, 'mensaje' => 'Faltan datos.']);
    exit;
}

// Buscar usuario por Nombre_Completo
$stmt = $pdo->prepare("SELECT idUsuario, Nombre_Completo, Hash_Contrasena FROM usuarios WHERE Nombre_Completo = :nombre");
$stmt->execute(['nombre' => $nombre]);
$usuario = $stmt->fetch();

if ($usuario && password_verify($contrasena, $usuario['Hash_Contrasena'])) {
    echo json_encode([
        'exito' => true,
        'usuario' => [
            'idUsuario' => $usuario['idUsuario'],
            'Nombre_Completo' => $usuario['Nombre_Completo']
        ]
    ]);
} else {
    echo json_encode(['exito' => false, 'mensaje' => 'Credenciales incorrectas.']);
}
