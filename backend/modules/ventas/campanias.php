<?php
// backend/modules/ventas/campanias.php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

try {
    $pdo = ventas_pdo();
    ventas_tablas_verificadas($pdo);
    $action = (string)($_GET['action'] ?? 'ventas_campanias');

    if ($action === 'ventas_campanias' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        $soloActivas = isset($_GET['solo_activas']) ? ventas_bool($_GET['solo_activas']) : 0;
        $where = $soloActivas ? 'WHERE c.activo = 1' : '';

        $sql = "
            SELECT
                c.*,
                'dni_persona' AS tipo_flujo,
                'dni' AS dato_requerido,
                CASE
                  WHEN c.activo = 1
                   AND c.visible_menu = 1
                   AND (c.fecha_inicio IS NULL OR c.fecha_inicio <= CURDATE())
                   AND (c.fecha_fin IS NULL OR c.fecha_fin >= CURDATE())
                   AND pp.id_producto IS NOT NULL
                   AND pp.activo = 1
                  THEN 1 ELSE 0
                END AS disponible_menu,
                CASE WHEN c.id_producto_principal IS NULL THEN 0 ELSE 1 END AS productos_total,
                CASE WHEN pp.id_producto IS NOT NULL AND pp.activo = 1 THEN 1 ELSE 0 END AS productos_activos,
                (SELECT COUNT(*) FROM ventas_ordenes o WHERE o.id_campania = c.id_campania) AS ordenes_total,
                c.id_producto_principal AS id_producto_principal,
                pp.nombre AS producto_principal_nombre,
                pp.descripcion AS producto_principal_descripcion,
                COALESCE(pp.precio_anticipada, pp.precio) AS producto_principal_precio,
                COALESCE(pp.precio_anticipada, pp.precio) AS producto_principal_precio_anticipada,
                COALESCE(pp.precio_puerta, pp.precio_anticipada, pp.precio) AS producto_principal_precio_puerta,
                pp.stock AS producto_principal_stock,
                pp.activo AS producto_principal_activo
            FROM ventas_campanias c
            LEFT JOIN ventas_productos pp ON pp.id_producto = c.id_producto_principal
            $where
            ORDER BY c.activo DESC, c.id_campania DESC
        ";

        $items = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
        foreach ($items as &$item) {
            $item['tipo_persona'] = 'vendedor';
            $item['tipo_flujo'] = 'dni_persona';
            $item['dato_requerido'] = 'dni';
        }
        unset($item);
        ventas_json(['exito' => true, 'items' => $items]);
    }

    if ($action === 'ventas_campania_guardar') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            ventas_json(['exito' => false, 'mensaje' => 'Método no permitido.'], 405);
        }

        $in = ventas_body();
        $id = (int)($in['id_campania'] ?? 0);
        $nombre = ventas_text($in['nombre'] ?? '', 150, false);
        $tipoPersona = 'vendedor'; // Flujo unificado: siempre se pide DNI.
        $idProductoPrincipal = (int)($in['id_producto_principal'] ?? 0);

        if ($nombre === '') {
            throw new InvalidArgumentException('El nombre de la venta es obligatorio.');
        }
        if ($idProductoPrincipal <= 0) {
            throw new InvalidArgumentException('Seleccioná el producto que se va a vender. Los productos se cargan desde la pestaña Productos.');
        }

        $stProducto = $pdo->prepare('SELECT id_producto, nombre, activo, COALESCE(precio_anticipada, precio) AS precio_anticipada FROM ventas_productos WHERE id_producto = :id LIMIT 1');
        $stProducto->execute([':id' => $idProductoPrincipal]);
        $producto = $stProducto->fetch(PDO::FETCH_ASSOC);
        if (!$producto) {
            throw new InvalidArgumentException('El producto seleccionado no existe o fue eliminado.');
        }

        $fechaInicio = ventas_date_or_null($in['fecha_inicio'] ?? null);
        $fechaFin = ventas_date_or_null($in['fecha_fin'] ?? null);
        if ($fechaInicio && $fechaFin && $fechaFin < $fechaInicio) {
            throw new InvalidArgumentException('La fecha de fin no puede ser menor a la fecha de inicio.');
        }

        $activo = ventas_bool($in['activo'] ?? 1, 1);
        $visibleMenu = ventas_bool($in['visible_menu'] ?? 1, 1);
        if ($activo === 1 && $visibleMenu === 1 && (int)$producto['activo'] !== 1) {
            throw new InvalidArgumentException('El producto seleccionado está inactivo. Activá el producto desde la pestaña Productos o elegí otro.');
        }
        if ($activo === 1 && $visibleMenu === 1 && (float)($producto['precio_anticipada'] ?? 0) <= 0) {
            throw new InvalidArgumentException('Para mostrar esta venta en el bot, el producto debe tener precio anticipada mayor a cero.');
        }

        $preguntaDefault = ventas_pregunta_default($tipoPersona);
        $mensajeInicioDefault = ventas_mensaje_inicio_default($tipoPersona);

        $data = [
            ':nombre' => $nombre,
            ':activo' => $activo,
            ':visible_menu' => $visibleMenu,
            ':tipo_persona' => $tipoPersona,
            ':pregunta_persona' => ventas_nullable_text($in['pregunta_persona'] ?? $preguntaDefault, 1000, false) ?: $preguntaDefault,
            ':mensaje_inicio' => ventas_nullable_text($in['mensaje_inicio'] ?? $mensajeInicioDefault, 5000, false) ?: $mensajeInicioDefault,
            ':mensaje_aprobado' => ventas_nullable_text($in['mensaje_aprobado'] ?? 'Pago aprobado. Te enviamos el comprobante en PDF.', 5000, false) ?: 'Pago aprobado. Te enviamos el comprobante en PDF.',
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin' => $fechaFin,
            ':id_producto_principal' => $idProductoPrincipal,
        ];

        $pdo->beginTransaction();
        try {
            if ($id > 0) {
                $data[':id'] = $id;
                $sql = "
                    UPDATE ventas_campanias
                    SET nombre = :nombre,
                        activo = :activo,
                        visible_menu = :visible_menu,
                        tipo_persona = :tipo_persona,
                        pregunta_persona = :pregunta_persona,
                        mensaje_inicio = :mensaje_inicio,
                        mensaje_aprobado = :mensaje_aprobado,
                        fecha_inicio = :fecha_inicio,
                        fecha_fin = :fecha_fin,
                        id_producto_principal = :id_producto_principal
                    WHERE id_campania = :id
                    LIMIT 1
                ";
                $st = $pdo->prepare($sql);
                $st->execute($data);
            } else {
                $sql = "
                    INSERT INTO ventas_campanias
                    (nombre, activo, visible_menu, tipo_persona, pregunta_persona,
                     mensaje_inicio, mensaje_aprobado, fecha_inicio, fecha_fin, id_producto_principal)
                    VALUES
                    (:nombre, :activo, :visible_menu, :tipo_persona, :pregunta_persona,
                     :mensaje_inicio, :mensaje_aprobado, :fecha_inicio, :fecha_fin, :id_producto_principal)
                ";
                $st = $pdo->prepare($sql);
                $st->execute($data);
                $id = (int)$pdo->lastInsertId();
            }

            if ($activo === 1) {
                $st = $pdo->prepare('UPDATE ventas_campanias SET activo = 0, visible_menu = 0 WHERE id_campania <> :id');
                $st->execute([':id' => $id]);
            }

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        ventas_json([
            'exito' => true,
            'id_campania' => $id,
            'id_producto_principal' => $idProductoPrincipal,
            'mensaje' => $activo === 1
                ? 'Venta guardada correctamente. Las demás ventas quedaron inactivas.'
                : 'Venta guardada correctamente.',
        ]);
    }

    if ($action === 'ventas_campania_estado') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            ventas_json(['exito' => false, 'mensaje' => 'Método no permitido.'], 405);
        }

        $in = ventas_body();
        $id = (int)($in['id_campania'] ?? 0);
        $activo = ventas_bool($in['activo'] ?? 0);
        if ($id <= 0) throw new InvalidArgumentException('ID de venta inválido.');

        $st = $pdo->prepare("SELECT c.id_campania, c.nombre, c.id_producto_principal, p.activo AS producto_activo, COALESCE(p.precio_anticipada, p.precio) AS producto_precio_anticipada FROM ventas_campanias c LEFT JOIN ventas_productos p ON p.id_producto = c.id_producto_principal WHERE c.id_campania = :id LIMIT 1");
        $st->execute([':id' => $id]);
        $campania = $st->fetch(PDO::FETCH_ASSOC);
        if (!$campania) throw new InvalidArgumentException('La venta no existe.');

        if ($activo === 1) {
            if (empty($campania['id_producto_principal']) || (int)$campania['producto_activo'] !== 1) {
                throw new InvalidArgumentException('Para activar la venta, primero seleccioná un producto activo.');
            }
            if ((float)($campania['producto_precio_anticipada'] ?? 0) <= 0) {
                throw new InvalidArgumentException('Para activar la venta en el bot, el producto debe tener precio anticipada mayor a cero.');
            }

            $pdo->beginTransaction();
            try {
                $st = $pdo->prepare('UPDATE ventas_campanias SET activo = 0, visible_menu = 0 WHERE id_campania <> :id');
                $st->execute([':id' => $id]);

                $st = $pdo->prepare('UPDATE ventas_campanias SET activo = 1, visible_menu = 1 WHERE id_campania = :id LIMIT 1');
                $st->execute([':id' => $id]);

                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $e;
            }
        } else {
            $st = $pdo->prepare('UPDATE ventas_campanias SET activo = 0, visible_menu = 0 WHERE id_campania = :id LIMIT 1');
            $st->execute([':id' => $id]);
        }

        ventas_json(['exito' => true, 'mensaje' => $activo === 1 ? 'Venta activada correctamente.' : 'Venta dada de baja correctamente.']);
    }

    if ($action === 'ventas_campania_eliminar') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            ventas_json(['exito' => false, 'mensaje' => 'Método no permitido.'], 405);
        }
        $in = ventas_body();
        $id = (int)($in['id_campania'] ?? 0);
        if ($id <= 0) throw new InvalidArgumentException('ID de venta inválido.');

        $st = $pdo->prepare('SELECT COUNT(*) FROM ventas_ordenes WHERE id_campania = :id');
        $st->execute([':id' => $id]);
        if ((int)$st->fetchColumn() > 0) {
            throw new RuntimeException('No se puede eliminar esta venta porque ya tiene ventas registradas. Usá el botón de dar de baja para ocultarla.');
        }

        $pdo->beginTransaction();
        try {
            if (ventas_column_exists($pdo, 'ventas_productos', 'id_campania')) {
                $st = $pdo->prepare('UPDATE ventas_productos SET id_campania = NULL WHERE id_campania = :id');
                $st->execute([':id' => $id]);
            }

            $st = $pdo->prepare('DELETE FROM ventas_campanias WHERE id_campania = :id LIMIT 1');
            $st->execute([':id' => $id]);

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        ventas_json(['exito' => true, 'mensaje' => 'Venta eliminada correctamente.']);
    }

    ventas_json(['exito' => false, 'mensaje' => 'Acción de ventas no válida.'], 404);
} catch (Throwable $e) {
    ventas_json(['exito' => false, 'mensaje' => $e->getMessage()], 200);
}
