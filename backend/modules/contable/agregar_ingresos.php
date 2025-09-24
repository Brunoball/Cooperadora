<?php
/**
 * backend/modules/contable/agregar_ingresos.php
 *
 * - GET  : lista ingresos por año/mes
 *          Params opcionales: ?year=YYYY&month=MM
 * - POST : crea un ingreso
 *          Body JSON:
 *          {
 *            "fecha": "YYYY-MM-DD",
 *            "id_cont_categoria": 1 | null,
 *            "id_cont_proveedor": 2 | null,
 *            "id_cont_descripcion": 3 | null,
 *            "id_medio_pago": 1,
 *            "importe": 12345
 *          }
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

try {
    // Conexión PDO
    if (!isset($pdo)) {
        require_once __DIR__ . '/../../config/db.php';
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
        $year  = isset($_GET['year'])  ? (int)$_GET['year']  : (int)date('Y');
        $month = isset($_GET['month']) ? (int)$_GET['month'] : 0;

        $where  = "YEAR(i.fecha) = :y";
        $params = [':y' => $year];
        if ($month >= 1 && $month <= 12) {
            $where .= " AND MONTH(i.fecha) = :m";
            $params[':m'] = $month;
        }

        $sql = "
            SELECT
                i.id_ingreso,
                DATE_FORMAT(i.fecha, '%Y-%m-%d') AS fecha,
                i.id_cont_categoria,
                cc.nombre_categoria      AS categoria,
                i.id_cont_proveedor,
                cp.nombre_proveedor      AS proveedor,
                i.id_cont_descripcion,
                cd.nombre_descripcion    AS descripcion,
                i.id_medio_pago,
                mp.medio_pago,
                i.importe
            FROM ingresos i
            LEFT JOIN contable_categoria   cc ON cc.id_cont_categoria   = i.id_cont_categoria
            LEFT JOIN contable_proveedor   cp ON cp.id_cont_proveedor   = i.id_cont_proveedor
            LEFT JOIN contable_descripcion cd ON cd.id_cont_descripcion = i.id_cont_descripcion
            INNER JOIN medio_pago          mp ON mp.id_medio_pago       = i.id_medio_pago
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
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido.']);
        exit;
    }

    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new InvalidArgumentException('JSON inválido.');
    }

    $fecha               = trim((string)($data['fecha'] ?? ''));
    $idContCategoria     = isset($data['id_cont_categoria'])    && $data['id_cont_categoria']    !== '' ? (int)$data['id_cont_categoria']    : null;
    $idContProveedor     = isset($data['id_cont_proveedor'])    && $data['id_cont_proveedor']    !== '' ? (int)$data['id_cont_proveedor']    : null;
    $idContDescripcion   = isset($data['id_cont_descripcion'])  && $data['id_cont_descripcion']  !== '' ? (int)$data['id_cont_descripcion']  : null;
    $idMedioPago         = isset($data['id_medio_pago']) ? (int)$data['id_medio_pago'] : 0;
    $importe             = $data['importe'] ?? null;

    // Validaciones básicas
    if (!$fecha || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
        throw new InvalidArgumentException('fecha requerida con formato YYYY-MM-DD.');
    }
    if (!is_numeric($importe) || (float)$importe <= 0) {
        throw new InvalidArgumentException('importe inválido.');
    }
    if ($idMedioPago < 1) {
        throw new InvalidArgumentException('id_medio_pago requerido.');
    }

    // Validar medio de pago
    $chk = $pdo->prepare("SELECT 1 FROM medio_pago WHERE id_medio_pago = :id");
    $chk->execute([':id' => $idMedioPago]);
    if (!$chk->fetchColumn()) {
        throw new InvalidArgumentException('id_medio_pago inexistente.');
    }

    // Validar FK opcionales (si vienen)
    if ($idContCategoria !== null) {
        $q = $pdo->prepare("SELECT 1 FROM contable_categoria WHERE id_cont_categoria = :id");
        $q->execute([':id' => $idContCategoria]);
        if (!$q->fetchColumn()) {
            throw new InvalidArgumentException('id_cont_categoria inexistente.');
        }
    }
    if ($idContProveedor !== null) {
        $q = $pdo->prepare("SELECT 1 FROM contable_proveedor WHERE id_cont_proveedor = :id");
        $q->execute([':id' => $idContProveedor]);
        if (!$q->fetchColumn()) {
            throw new InvalidArgumentException('id_cont_proveedor inexistente.');
        }
    }
    if ($idContDescripcion !== null) {
        $q = $pdo->prepare("SELECT 1 FROM contable_descripcion WHERE id_cont_descripcion = :id");
        $q->execute([':id' => $idContDescripcion]);
        if (!$q->fetchColumn()) {
            throw new InvalidArgumentException('id_cont_descripcion inexistente.');
        }
    }

    // Insert en la nueva estructura
    $sql = "
        INSERT INTO ingresos
            (fecha, id_cont_categoria, id_cont_proveedor, id_cont_descripcion, id_medio_pago, importe)
        VALUES
            (:fecha, :cat, :prov, :desc, :medio, :importe)
    ";
    $st = $pdo->prepare($sql);
    $st->execute([
        ':fecha'  => $fecha,
        ':cat'    => $idContCategoria,
        ':prov'   => $idContProveedor,
        ':desc'   => $idContDescripcion,
        ':medio'  => $idMedioPago,
        ':importe'=> (int)$importe
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
        'mensaje' => 'Error: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
