<?php
// backend/modules/categorias/editar_categoria.php
require_once realpath(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json; charset=utf-8');

try {
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) $data = $_POST;

    $id = isset($data['id']) ? (int)$data['id'] : 0; // id_cat_monto
    if ($id <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID inválido']);
        exit;
    }

    $hasMens = array_key_exists('monto', $data) || array_key_exists('precio', $data);
    $hasAnu  = array_key_exists('monto_anual', $data);

    // si no vino nada, no hacemos cambios
    if (!$hasMens && !$hasAnu) {
        echo json_encode(['exito' => true, 'mensaje' => 'Sin cambios (no se enviaron montos).', 'historial' => false]);
        exit;
    }

    $pdo->beginTransaction();

    // leer actuales y bloquear fila
    $stmt = $pdo->prepare('SELECT monto_mensual, monto_anual FROM categoria_monto WHERE id_cat_monto = :id FOR UPDATE');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        $pdo->rollBack();
        echo json_encode(['exito' => false, 'mensaje' => 'Categoría no encontrada']);
        exit;
    }

    $mMensOld = (int)($row['monto_mensual'] ?? 0);
    $mAnuOld  = (int)($row['monto_anual'] ?? 0);

    $changed = false;

    // 1) Mensual
    if ($hasMens) {
        $mMensNew = $data['monto'] ?? $data['precio'];
        $mMensNew = (int)($mMensNew === '' || $mMensNew === null ? 0 : $mMensNew);
        if ($mMensNew < 0) {
            $pdo->rollBack();
            echo json_encode(['exito' => false, 'mensaje' => 'Monto mensual inválido (>= 0)']);
            exit;
        }
        if ($mMensNew !== $mMensOld) {
            $u = $pdo->prepare('UPDATE categoria_monto SET monto_mensual = :m WHERE id_cat_monto = :id');
            $u->execute([':m' => $mMensNew, ':id' => $id]);

            // historial MENSUAL
            $h = $pdo->prepare('
                INSERT INTO precios_historicos (id_cat_monto, precio_anterior, precio_nuevo, fecha_cambio, tipo)
                VALUES (:idc, :pa, :pn, CURDATE(), "MENSUAL")
            ');
            $h->execute([':idc' => $id, ':pa' => $mMensOld, ':pn' => $mMensNew]);

            $changed = true;
            $mMensOld = $mMensNew; // por si alguien lee el retorno
        }
    }

    // 2) Anual
    if ($hasAnu) {
        $mAnuNew = $data['monto_anual'];
        $mAnuNew = (int)($mAnuNew === '' || $mAnuNew === null ? 0 : $mAnuNew);
        if ($mAnuNew < 0) {
            $pdo->rollBack();
            echo json_encode(['exito' => false, 'mensaje' => 'Monto anual inválido (>= 0)']);
            exit;
        }
        if ($mAnuNew !== $mAnuOld) {
            $u = $pdo->prepare('UPDATE categoria_monto SET monto_anual = :m WHERE id_cat_monto = :id');
            $u->execute([':m' => $mAnuNew, ':id' => $id]);

            // historial ANUAL
            $h = $pdo->prepare('
                INSERT INTO precios_historicos (id_cat_monto, precio_anterior, precio_nuevo, fecha_cambio, tipo)
                VALUES (:idc, :pa, :pn, CURDATE(), "ANUAL")
            ');
            $h->execute([':idc' => $id, ':pa' => $mAnuOld, ':pn' => $mAnuNew]);

            $changed = true;
            $mAnuOld = $mAnuNew;
        }
    }

    $pdo->commit();

    echo json_encode([
        'exito'  => true,
        'mensaje'=> $changed ? 'Categoría actualizada' : 'Sin cambios',
        'historial' => $changed,
        'monto_mensual' => $mMensOld,
        'monto_anual'   => $mAnuOld,
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['exito' => false, 'mensaje' => 'Error al actualizar categoría: ' . $e->getMessage()]);
}
