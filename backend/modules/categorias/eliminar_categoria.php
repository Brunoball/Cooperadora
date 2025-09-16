<?php
// backend/modules/categorias/eliminar_categoria.php
declare(strict_types=1);

require_once realpath(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json; charset=utf-8');

try {
    // Lee JSON o FormData
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) $data = $_POST;

    $id = isset($data['id']) ? (int)$data['id'] : 0; // id_cat_monto
    if ($id <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID inválido']);
        exit;
    }

    // Transacción para asegurar atomicidad
    $pdo->beginTransaction();

    // Verificar existencia de la categoría (y bloquearla)
    $check = $pdo->prepare('
        SELECT id_cat_monto, nombre_categoria
        FROM categoria_monto
        WHERE id_cat_monto = :id
        FOR UPDATE
    ');
    $check->execute([':id' => $id]);
    $cat = $check->fetch(PDO::FETCH_ASSOC);
    if (!$cat) {
        $pdo->rollBack();
        echo json_encode(['exito' => false, 'mensaje' => 'La categoría no existe']);
        exit;
    }

    // 0) Calcular cuántos alumnos están usando esta categoría
    $stCount = $pdo->prepare('SELECT COUNT(*) AS c FROM alumnos WHERE id_cat_monto = :id');
    $stCount->execute([':id' => $id]);
    $alumnosUsando = (int)($stCount->fetch(PDO::FETCH_ASSOC)['c'] ?? 0);

    // 1) Desasociar alumnos: dejar id_cat_monto en NULL
    //    (hacemos UPDATE antes de borrar para evitar bloqueos por FK sin ON DELETE SET NULL)
    $upd = $pdo->prepare('UPDATE alumnos SET id_cat_monto = NULL WHERE id_cat_monto = :id');
    $upd->execute([':id' => $id]);
    $alumnosActualizados = $upd->rowCount();

    // 2) Borrar históricos asociados (limpieza aunque no exista FK en cascada)
    $delHist = $pdo->prepare('DELETE FROM precios_historicos WHERE id_cat_monto = :id');
    $delHist->execute([':id' => $id]);
    $histBorrados = $delHist->rowCount();

    // 3) Borrar la categoría
    $delCat = $pdo->prepare('DELETE FROM categoria_monto WHERE id_cat_monto = :id');
    $delCat->execute([':id' => $id]);
    $catBorradas = $delCat->rowCount();

    $pdo->commit();

    echo json_encode([
        'exito' => true,
        'mensaje' => 'Categoría eliminada correctamente',
        'detalle' => [
            'categoria'            => $cat['nombre_categoria'],
            'alumnos_usando'       => $alumnosUsando,
            'alumnos_desasociados' => $alumnosActualizados,
            'historiales_borrados' => $histBorrados,
            'categorias_borradas'  => $catBorradas
        ]
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();

    // Mensaje más claro si hay otras FKs que bloqueen el borrado
    $msg = $e->getMessage();
    if (stripos($msg, 'foreign key') !== false) {
        $msg = 'No se puede eliminar: existen referencias activas (por ejemplo, alumnos u otras tablas).';
    }

    echo json_encode(['exito' => false, 'mensaje' => 'Error al eliminar categoría: ' . $msg]);
}
