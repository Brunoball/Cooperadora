<?php
// backend/modules/categorias/editar_categoria.php
require_once realpath(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json; charset=utf-8');

try {
    // 1) Intentar JSON
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    // 2) Si no vino JSON, usar $_POST (FormData)
    if (!is_array($data)) $data = $_POST;

    // Aceptar 'id', y 'precio' o 'monto'
    $id       = isset($data['id']) ? (int)$data['id'] : 0;
    $precioIn = $data['precio'] ?? $data['monto'] ?? null;

    if ($id <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID inválido']);
        exit;
    }

    if ($precioIn === null || $precioIn === '') $precioIn = 0;
    if (!is_numeric($precioIn) || $precioIn < 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'El monto debe ser un número mayor o igual a 0']);
        exit;
    }

    $precioNuevo = (int)$precioIn;

    // --- Transacción para asegurar atomicidad ---
    $pdo->beginTransaction();

    // Leer precio actual y bloquear la fila (ajustar nombres si tu tabla es 'categorias')
    $stmt = $pdo->prepare('SELECT monto FROM categoria WHERE id_categoria = :id FOR UPDATE');
    $stmt->execute([':id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        $pdo->rollBack();
        echo json_encode(['exito' => false, 'mensaje' => 'Categoría no encontrada']);
        exit;
    }

    $precioAnterior = (int)($row['monto'] ?? 0);

    // Si no cambió, no escribimos historial
    if ($precioAnterior === $precioNuevo) {
        $pdo->commit();
        echo json_encode([
            'exito'            => true,
            'mensaje'          => 'Sin cambios: el monto es el mismo',
            'precio_anterior'  => $precioAnterior,
            'precio_nuevo'     => $precioNuevo,
            'historial'        => false
        ]);
        exit;
    }

    // Actualizar categoría
    $stmt = $pdo->prepare('UPDATE categoria SET monto = :monto WHERE id_categoria = :id');
    $stmt->execute([
        ':monto' => $precioNuevo,
        ':id'    => $id
    ]);

    // Insertar historial con solo FECHA (CURDATE())
    $stmt = $pdo->prepare('
        INSERT INTO precios_historicos (id_categoria, precio_anterior, precio_nuevo, fecha_cambio)
        VALUES (:id_categoria, :precio_anterior, :precio_nuevo, CURDATE())
    ');
    $stmt->execute([
        ':id_categoria'    => $id,
        ':precio_anterior' => $precioAnterior,
        ':precio_nuevo'    => $precioNuevo
    ]);

    $pdo->commit();

    echo json_encode([
        'exito'            => true,
        'mensaje'          => 'Monto actualizado',
        'precio_anterior'  => $precioAnterior,
        'precio_nuevo'     => $precioNuevo,
        'historial'        => true
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['exito' => false, 'mensaje' => 'Error al actualizar categoría: ' . $e->getMessage()]);
}
