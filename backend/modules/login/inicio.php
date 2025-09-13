<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once(__DIR__ . '/../../config/db.php');

/*
  Espera JSON:
  {
    "nombre": "usuario",
    "contrasena": "secreta"
  }

  Devuelve (en éxito):
  {
    "exito": true,
    "usuario": {
      "idUsuario": 1,
      "Nombre_Completo": "usuario",
      "rol": "admin" | "vista"
    },
    "token": "" // si lo querés agregar luego
  }
*/

try {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);

    $nombre = isset($data['nombre']) ? trim($data['nombre']) : '';
    $contrasena = isset($data['contrasena']) ? (string)$data['contrasena'] : '';

    if ($nombre === '' || $contrasena === '') {
        echo json_encode(['exito' => false, 'mensaje' => 'Faltan datos.']);
        exit;
    }

    // ⚠️ Usa el esquema correcto; si tu tabla está en cooperadora.usuarios, déjalo así:
    $sql = "SELECT idUsuario, Nombre_Completo, Hash_Contrasena, rol
            FROM cooperadora.usuarios
            WHERE Nombre_Completo = :nombre
            LIMIT 1";

    $stmt = $pdo->prepare($sql);
    $stmt->execute(['nombre' => $nombre]);
    $usuario = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($usuario && password_verify($contrasena, $usuario['Hash_Contrasena'])) {
        // Normalizamos el rol a minúsculas por consistencia
        $rol = strtolower($usuario['rol'] ?? 'vista');

        echo json_encode([
            'exito'  => true,
            'usuario'=> [
                'idUsuario'       => (int)$usuario['idUsuario'],
                'Nombre_Completo' => (string)$usuario['Nombre_Completo'],
                'rol'             => $rol, // 👈 DEVUELVE EL ROL
            ],
            // 'token' => '...' // opcional si luego agregás JWT
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['exito' => false, 'mensaje' => 'Credenciales incorrectas.'], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error del servidor.',
        'detalle' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
