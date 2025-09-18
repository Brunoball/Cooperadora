<?php
/**
 * backend/modules/contable/agregar_ingresos.php
 *
 * - GET  : lista de ingresos por año / mes (action=ingresos_list)
 *          Params: ?year=YYYY&month=MM
 * - POST : crea un ingreso (action=ingresos_create)
 *          Body JSON: { fecha, denominacion, descripcion, importe, id_medio_pago }
 */

header('Content-Type: application/json; charset=utf-8');

try {
    // Conexión
    if (!isset($pdo)) {
        require_once __DIR__ . '/../../config/db.php'; // ../../ desde modules/contable -> backend/config
    }
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    /* =======================
       GET: listar ingresos
    ======================== */
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $year  = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
        $month = isset($_GET['month']) ? (int)$_GET['month'] : 0;

        $where   = "YEAR(i.fecha) = :y";
        $params  = [':y' => $year];
        if ($month >= 1 && $month <= 12) {
            $where  .= " AND MONTH(i.fecha) = :m";
            $params[':m'] = $month;
        }

        $sql = "
            SELECT
              i.id_ingreso,
              DATE_FORMAT(i.fecha, '%Y-%m-%d') AS fecha,
              i.denominacion,
              i.descripcion,
              i.importe,
              i.id_medio_pago,
              mp.medio_pago
            FROM ingresos i
            INNER JOIN medio_pago mp ON mp.id_medio_pago = i.id_medio_pago
            WHERE $where
            ORDER BY i.fecha ASC, i.id_ingreso ASC
        ";
        $st = $pdo->prepare($sql);
        $st->execute($params);
        $items = $st->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['exito' => true, 'items' => $items], JSON_UNESCAPED_UNICODE);
        exit;
    }

    /* =======================
       POST: crear ingreso
    ======================== */
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
        exit;
    }

    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new InvalidArgumentException('JSON inválido.');
    }

    $fecha         = trim((string)($data['fecha'] ?? ''));
    $denominacion  = trim((string)($data['denominacion'] ?? ''));
    $descripcion   = trim((string)($data['descripcion'] ?? ''));
    $importe       = $data['importe'] ?? null; // número
    $id_medio_pago = isset($data['id_medio_pago']) ? (int)$data['id_medio_pago'] : 0;

    // Validaciones
    if (!$fecha || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
        throw new InvalidArgumentException('fecha requerida con formato YYYY-MM-DD.');
    }
    if ($denominacion === '') {
        throw new InvalidArgumentException('denominacion requerida.');
    }
    if (!is_numeric($importe) || (float)$importe <= 0) {
        throw new InvalidArgumentException('importe inválido.');
    }
    if ($id_medio_pago < 1) {
        throw new InvalidArgumentException('id_medio_pago requerido.');
    }

    // Validar medio de pago existente
    $chk = $pdo->prepare("SELECT 1 FROM medio_pago WHERE id_medio_pago = :id");
    $chk->execute([':id' => $id_medio_pago]);
    if (!$chk->fetchColumn()) {
        throw new InvalidArgumentException('id_medio_pago inexistente.');
    }

    // Insert
    $sql = "
        INSERT INTO ingresos (fecha, denominacion, descripcion, importe, id_medio_pago)
        VALUES (:fecha, :denominacion, :descripcion, :importe, :id_medio_pago)
    ";
    $st = $pdo->prepare($sql);
    $st->execute([
        ':fecha'         => $fecha,
        ':denominacion'  => $denominacion,
        ':descripcion'   => ($descripcion !== '' ? $descripcion : null),
        ':importe'       => (float)$importe,
        ':id_medio_pago' => $id_medio_pago,
    ]);

    echo json_encode([
        'exito'      => true,
        'id_ingreso' => (int)$pdo->lastInsertId(),
        'mensaje'    => 'Ingreso registrado correctamente.'
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(400);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
