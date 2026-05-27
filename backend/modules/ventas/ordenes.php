<?php
// backend/modules/ventas/ordenes.php
// Lista, agrega y edita ventas registradas. Las ventas manuales sirven para pagos en efectivo u otros medios.

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function ventas_orden_codigo_manual(PDO $pdo): string {
    for ($i = 0; $i < 8; $i++) {
        $codigo = 'MAN-' . date('Ymd-His') . '-' . random_int(100, 999);
        $st = $pdo->prepare('SELECT 1 FROM ventas_ordenes WHERE codigo_orden = :codigo LIMIT 1');
        $st->execute([':codigo' => $codigo]);
        if (!$st->fetchColumn()) return $codigo;
    }
    return 'MAN-' . date('Ymd-His') . '-' . bin2hex(random_bytes(2));
}

function ventas_fecha_venta_sql($value): string {
    $v = trim((string)($value ?? ''));
    if ($v === '') return date('Y-m-d H:i:s');

    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) {
        $parts = explode('-', $v);
        if (checkdate((int)$parts[1], (int)$parts[2], (int)$parts[0])) {
            return $v . ' ' . date('H:i:s');
        }
    }

    if (preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/', $v)) {
        $ts = strtotime(str_replace('T', ' ', $v));
        if ($ts !== false) return date('Y-m-d H:i:s', $ts);
    }

    return date('Y-m-d H:i:s');
}

function ventas_estado_orden($value): string {
    $estado = strtolower(trim((string)($value ?? 'aprobada')));
    $permitidos = ['pendiente', 'aprobada', 'cancelada', 'fallida', 'vencida'];
    return in_array($estado, $permitidos, true) ? $estado : 'aprobada';
}

try {
    $pdo = ventas_pdo();
    ventas_tablas_verificadas($pdo);
    $action = (string)($_GET['action'] ?? 'ventas_ordenes');

    if ($action === 'ventas_medios_pago') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
            ventas_json(['exito' => false, 'mensaje' => 'Método no permitido.'], 405);
        }

        $items = $pdo->query('SELECT id_medio_pago, medio_pago FROM medio_pago ORDER BY medio_pago ASC')->fetchAll(PDO::FETCH_ASSOC);
        ventas_json(['exito' => true, 'items' => $items]);
    }

    if ($action === 'ventas_ordenes' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        $idCampania = isset($_GET['id_campania']) ? (int)$_GET['id_campania'] : 0;
        $estado = ventas_text($_GET['estado'] ?? '', 30, false);
        $q = ventas_text($_GET['q'] ?? '', 120, false);

        $where = [];
        $params = [];

        if ($idCampania > 0) {
            $where[] = 'o.id_campania = :id_campania';
            $params[':id_campania'] = $idCampania;
        }
        if ($estado !== '') {
            $where[] = 'o.estado = :estado';
            $params[':estado'] = $estado;
        }
        if ($q !== '') {
            $where[] = '(o.codigo_orden LIKE :q OR o.persona_nombre LIKE :q OR o.persona_detalle LIKE :q OR o.comprador_telefono LIKE :q OR o.payment_id LIKE :q OR mp.medio_pago LIKE :q)';
            $params[':q'] = '%' . $q . '%';
        }

        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $sql = "
            SELECT
                o.*,
                c.nombre AS campania_nombre,
                mp.medio_pago,
                i.id_producto,
                i.producto_nombre,
                i.cantidad,
                i.precio_unitario,
                (SELECT COUNT(*) FROM ventas_orden_items ix WHERE ix.id_orden = o.id_orden) AS items_cantidad
            FROM ventas_ordenes o
            LEFT JOIN ventas_campanias c ON c.id_campania = o.id_campania
            LEFT JOIN medio_pago mp ON mp.id_medio_pago = o.id_medio_pago
            LEFT JOIN ventas_orden_items i ON i.id_item = (
                SELECT ii.id_item
                FROM ventas_orden_items ii
                WHERE ii.id_orden = o.id_orden
                ORDER BY ii.id_item ASC
                LIMIT 1
            )
            $whereSql
            ORDER BY o.id_orden DESC
            LIMIT 300
        ";

        $st = $pdo->prepare($sql);
        $st->execute($params);
        ventas_json(['exito' => true, 'items' => $st->fetchAll(PDO::FETCH_ASSOC)]);
    }


    if ($action === 'ventas_orden_retiro') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            ventas_json(['exito' => false, 'mensaje' => 'Método no permitido.'], 405);
        }

        $in = ventas_body();
        $idOrden = (int)($in['id_orden'] ?? 0);
        $retirado = ventas_bool($in['retirado'] ?? 0, 0);

        if ($idOrden <= 0) {
            throw new InvalidArgumentException('No se recibió la venta a actualizar.');
        }

        $st = $pdo->prepare('SELECT id_orden, estado FROM ventas_ordenes WHERE id_orden = :id LIMIT 1');
        $st->execute([':id' => $idOrden]);
        $orden = $st->fetch(PDO::FETCH_ASSOC);

        if (!$orden) {
            throw new InvalidArgumentException('La venta registrada no existe.');
        }

        if ((string)($orden['estado'] ?? '') !== 'aprobada' && $retirado === 1) {
            throw new InvalidArgumentException('Solo se puede marcar como retirado un pago aprobado.');
        }

        $st = $pdo->prepare(" 
            UPDATE ventas_ordenes
            SET retirado = :retirado,
                retirado_en = CASE WHEN :retirado_en_flag = 1 THEN NOW() ELSE NULL END,
                actualizado_en = NOW()
            WHERE id_orden = :id_orden
            LIMIT 1
        ");
        $st->execute([
            ':retirado' => $retirado,
            ':retirado_en_flag' => $retirado,
            ':id_orden' => $idOrden,
        ]);

        $st = $pdo->prepare('SELECT id_orden, retirado, retirado_en, actualizado_en FROM ventas_ordenes WHERE id_orden = :id LIMIT 1');
        $st->execute([':id' => $idOrden]);

        ventas_json([
            'exito' => true,
            'item' => $st->fetch(PDO::FETCH_ASSOC),
            'mensaje' => $retirado ? 'Producto marcado como retirado.' : 'Producto marcado como pendiente de retiro.',
        ]);
    }

    if ($action === 'ventas_orden_guardar') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            ventas_json(['exito' => false, 'mensaje' => 'Método no permitido.'], 405);
        }

        $in = ventas_body();
        $idOrden = (int)($in['id_orden'] ?? 0);
        $idCampania = (int)($in['id_campania'] ?? 0);
        $idMedioPago = (int)($in['id_medio_pago'] ?? 0);
        $cantidad = max(1, (int)($in['cantidad'] ?? 1));
        $estado = ventas_estado_orden($in['estado'] ?? 'aprobada');
        $fechaVenta = ventas_fecha_venta_sql($in['fecha_venta'] ?? null);

        if ($idCampania <= 0) throw new InvalidArgumentException('Seleccioná la venta/campaña correspondiente.');
        if ($idMedioPago <= 0) throw new InvalidArgumentException('Seleccioná el medio de pago.');

        $st = $pdo->prepare('SELECT id_medio_pago FROM medio_pago WHERE id_medio_pago = :id LIMIT 1');
        $st->execute([':id' => $idMedioPago]);
        if (!$st->fetchColumn()) throw new InvalidArgumentException('El medio de pago seleccionado no existe.');

        $st = $pdo->prepare(" 
            SELECT
                c.id_campania,
                c.nombre AS campania_nombre,
                c.tipo_persona,
                p.id_producto,
                p.nombre AS producto_nombre,
                p.precio AS producto_precio
            FROM ventas_campanias c
            INNER JOIN ventas_productos p ON p.id_producto = c.id_producto_principal
            WHERE c.id_campania = :id
            LIMIT 1
        ");
        $st->execute([':id' => $idCampania]);
        $campania = $st->fetch(PDO::FETCH_ASSOC);
        if (!$campania) throw new InvalidArgumentException('La venta seleccionada no existe o no tiene producto asignado.');

        $personaNombre = ventas_text($in['persona_nombre'] ?? '', 160, true);
        $personaDetalle = ventas_nullable_text($in['persona_detalle'] ?? '', 160, true);
        $telefono = ventas_nullable_text($in['comprador_telefono'] ?? '', 40, false);
        $observacion = ventas_nullable_text($in['observacion'] ?? '', 5000, false);
        if ($personaNombre === '') throw new InvalidArgumentException('Ingresá el nombre informado para la venta.');

        $precioUnitario = ventas_decimal($campania['producto_precio'] ?? 0);
        $total = round($precioUnitario * $cantidad, 2);
        $aprobadoEn = $estado === 'aprobada' ? $fechaVenta : null;
        $canceladoEn = in_array($estado, ['cancelada', 'fallida', 'vencida'], true) ? $fechaVenta : null;

        $pdo->beginTransaction();
        try {
            if ($idOrden > 0) {
                $st = $pdo->prepare('SELECT id_orden, codigo_orden, origen FROM ventas_ordenes WHERE id_orden = :id LIMIT 1');
                $st->execute([':id' => $idOrden]);
                $actual = $st->fetch(PDO::FETCH_ASSOC);
                if (!$actual) throw new InvalidArgumentException('La venta registrada no existe.');

                $st = $pdo->prepare(" 
                    UPDATE ventas_ordenes
                    SET id_campania = :id_campania,
                        comprador_telefono = :comprador_telefono,
                        persona_tipo = :persona_tipo,
                        persona_nombre = :persona_nombre,
                        persona_detalle = :persona_detalle,
                        estado = :estado,
                        id_medio_pago = :id_medio_pago,
                        total = :total,
                        observacion = :observacion,
                        creado_en = :creado_en,
                        aprobado_en = :aprobado_en,
                        cancelado_en = :cancelado_en
                    WHERE id_orden = :id_orden
                    LIMIT 1
                ");
                $st->execute([
                    ':id_campania' => $idCampania,
                    ':comprador_telefono' => $telefono,
                    ':persona_tipo' => $campania['tipo_persona'],
                    ':persona_nombre' => $personaNombre,
                    ':persona_detalle' => $personaDetalle,
                    ':estado' => $estado,
                    ':id_medio_pago' => $idMedioPago,
                    ':total' => $total,
                    ':observacion' => $observacion,
                    ':creado_en' => $fechaVenta,
                    ':aprobado_en' => $aprobadoEn,
                    ':cancelado_en' => $canceladoEn,
                    ':id_orden' => $idOrden,
                ]);

                $pdo->prepare('DELETE FROM ventas_orden_items WHERE id_orden = :id_orden')->execute([':id_orden' => $idOrden]);
            } else {
                $codigo = ventas_orden_codigo_manual($pdo);
                $st = $pdo->prepare(" 
                    INSERT INTO ventas_ordenes
                    (codigo_orden, id_campania, comprador_telefono, persona_tipo, persona_nombre, persona_detalle,
                     estado, id_medio_pago, total, mp_status, origen, observacion, creado_en, aprobado_en, cancelado_en)
                    VALUES
                    (:codigo_orden, :id_campania, :comprador_telefono, :persona_tipo, :persona_nombre, :persona_detalle,
                     :estado, :id_medio_pago, :total, :mp_status, 'manual', :observacion, :creado_en, :aprobado_en, :cancelado_en)
                ");
                $st->execute([
                    ':codigo_orden' => $codigo,
                    ':id_campania' => $idCampania,
                    ':comprador_telefono' => $telefono,
                    ':persona_tipo' => $campania['tipo_persona'],
                    ':persona_nombre' => $personaNombre,
                    ':persona_detalle' => $personaDetalle,
                    ':estado' => $estado,
                    ':id_medio_pago' => $idMedioPago,
                    ':total' => $total,
                    ':mp_status' => 'manual',
                    ':observacion' => $observacion,
                    ':creado_en' => $fechaVenta,
                    ':aprobado_en' => $aprobadoEn,
                    ':cancelado_en' => $canceladoEn,
                ]);
                $idOrden = (int)$pdo->lastInsertId();
            }

            $st = $pdo->prepare(" 
                INSERT INTO ventas_orden_items
                (id_orden, id_producto, producto_nombre, cantidad, precio_unitario, subtotal)
                VALUES
                (:id_orden, :id_producto, :producto_nombre, :cantidad, :precio_unitario, :subtotal)
            ");
            $st->execute([
                ':id_orden' => $idOrden,
                ':id_producto' => (int)$campania['id_producto'],
                ':producto_nombre' => (string)$campania['producto_nombre'],
                ':cantidad' => $cantidad,
                ':precio_unitario' => $precioUnitario,
                ':subtotal' => $total,
            ]);

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        ventas_json(['exito' => true, 'id_orden' => $idOrden, 'mensaje' => 'Venta registrada correctamente.']);
    }

    ventas_json(['exito' => false, 'mensaje' => 'Acción de ventas registradas no válida.'], 404);
} catch (Throwable $e) {
    ventas_json(['exito' => false, 'mensaje' => $e->getMessage()], 200);
}
