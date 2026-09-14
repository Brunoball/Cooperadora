<?php
// backend/config/db.php
// Producción: mantiene los valores locales históricos si no hay variables de entorno.
// Testing Playwright: recibe COOP_TEST_MODE=1 + COOP_DB_* y BLOQUEA cualquier DB
// cuyo nombre no parezca una base exclusiva de pruebas.

$host   = getenv('COOP_DB_HOST') ?: 'localhost';
$port   = getenv('COOP_DB_PORT') ?: '3306';
$dbname = getenv('COOP_DB_NAME') ?: 'cooperadora';
$user   = getenv('COOP_DB_USER') ?: 'root';
$pass   = getenv('COOP_DB_PASS');
if ($pass === false) {
    $pass = 'brunoball516'; // compatibilidad con el entorno local actual
}

$testMode = getenv('COOP_TEST_MODE') === '1';

if ($testMode) {
    $safeName = preg_match('/(^|_)(test|pw|playwright)(_|$)/i', $dbname) === 1;
    $forbidden = in_array(strtolower($dbname), [
        'cooperadora',
        'u590795856_cooperadora',
    ], true);

    if (!$safeName || $forbidden) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'exito' => false,
            'mensaje' => 'SEGURIDAD TEST: se bloqueó la conexión porque COOP_DB_NAME no es una base exclusiva de testing.',
            'db' => $dbname,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

try {
    $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error de conexión a la base de datos: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}


//brunoball516