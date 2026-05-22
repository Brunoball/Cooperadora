<?php
// backend/modules/ventas/productos.php

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

try {
    $pdo = ventas_pdo();
    ventas_tablas_verificadas($pdo);
    $action = (string)($_GET['action'] ?? 'ventas_productos');

    if ($action === 'ventas_productos' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        $idCampania = isset($_GET['id_campania']) ? (int)$_GET['id_campania'] : 0;
        $soloActivos = isset($_GET['solo_activos']) ? ventas_bool($_GET['solo_activos']) : 0;
        $tieneColumnaCampaniaLegacy = (bool)ventas_column_exists($pdo, 'ventas_productos', 'id_campania');

        $where = [];
        $params = [];
        if ($idCampania > 0) {
            $condicionProductoCampania = "p.id_producto = (SELECT c.id_producto_principal FROM ventas_campanias c WHERE c.id_campania = :id_campania LIMIT 1)";
            if ($tieneColumnaCampaniaLegacy) {
                $condicionProductoCampania = "($condicionProductoCampania OR p.id_campania = :id_campania)";
            }
            $where[] = $condicionProductoCampania;
            $params[':id_campania'] = $idCampania;
        }
        if ($soloActivos) $where[] = 'p.activo = 1';
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $sql = "
            SELECT
                p.*,
                (
                    SELECT GROUP_CONCAT(c.nombre ORDER BY c.activo DESC, c.id_campania DESC SEPARATOR ', ')
                    FROM ventas_campanias c
                    WHERE c.id_producto_principal = p.id_producto
                ) AS campanias_asociadas
            FROM ventas_productos p
            $whereSql
            ORDER BY p.activo DESC, p.id_producto DESC
        ";
        $st = $pdo->prepare($sql);
        $st->execute($params);
        ventas_json(['exito' => true, 'items' => $st->fetchAll(PDO::FETCH_ASSOC)]);
    }

    if ($action === 'ventas_producto_guardar') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            ventas_json(['exito' => false, 'mensaje' => 'Método no permitido.'], 405);
        }
        $in = ventas_body();
        $id = (int)($in['id_producto'] ?? 0);
        $nombre = ventas_text($in['nombre'] ?? '', 150, false);
        $descripcion = ventas_nullable_text($in['descripcion'] ?? '', 2000, false);
        $precio = ventas_decimal($in['precio'] ?? 0);
        $stock = ventas_normalizar_stock($in['stock'] ?? null);
        $tieneColumnaCampaniaLegacy = (bool)ventas_column_exists($pdo, 'ventas_productos', 'id_campania');

        if ($nombre === '') throw new InvalidArgumentException('El nombre del producto es obligatorio.');
        if ($precio < 0) throw new InvalidArgumentException('El precio no puede ser negativo.');

        $activo = ventas_bool($in['activo'] ?? 1, 1);
        $data = [
            ':nombre' => $nombre,
            ':descripcion' => $descripcion,
            ':precio' => $precio,
            ':stock' => $stock,
            ':activo' => $activo,
        ];

        if ($id > 0) {
            $data[':id'] = $id;
            $setLegacy = $tieneColumnaCampaniaLegacy ? 'id_campania = NULL,' : '';
            $sql = "
                UPDATE ventas_productos
                SET $setLegacy
                    nombre = :nombre,
                    descripcion = :descripcion,
                    precio = :precio,
                    stock = :stock,
                    activo = :activo
                WHERE id_producto = :id
                LIMIT 1
            ";
            $st = $pdo->prepare($sql);
            $st->execute($data);
        } else {
            if ($tieneColumnaCampaniaLegacy) {
                $sql = "
                    INSERT INTO ventas_productos
                    (id_campania, nombre, descripcion, precio, stock, activo)
                    VALUES
                    (NULL, :nombre, :descripcion, :precio, :stock, :activo)
                ";
            } else {
                $sql = "
                    INSERT INTO ventas_productos
                    (nombre, descripcion, precio, stock, activo)
                    VALUES
                    (:nombre, :descripcion, :precio, :stock, :activo)
                ";
            }
            $st = $pdo->prepare($sql);
            $st->execute($data);
            $id = (int)$pdo->lastInsertId();
        }

        ventas_json(['exito' => true, 'id_producto' => $id, 'mensaje' => 'Producto guardado correctamente.']);
    }

    if ($action === 'ventas_producto_estado') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            ventas_json(['exito' => false, 'mensaje' => 'Método no permitido.'], 405);
        }
        $in = ventas_body();
        $id = (int)($in['id_producto'] ?? 0);
        $activo = ventas_bool($in['activo'] ?? 0);
        if ($id <= 0) throw new InvalidArgumentException('ID de producto inválido.');

        $st = $pdo->prepare('UPDATE ventas_productos SET activo = :activo WHERE id_producto = :id LIMIT 1');
        $st->execute([':activo' => $activo, ':id' => $id]);

        if ($activo === 0) {
            $st = $pdo->prepare('UPDATE ventas_campanias SET activo = 0, visible_menu = 0 WHERE id_producto_principal = :id');
            $st->execute([':id' => $id]);
        }

        ventas_json(['exito' => true, 'mensaje' => $activo === 1 ? 'Producto activado correctamente.' : 'Producto dado de baja correctamente.']);
    }

    if ($action === 'ventas_producto_eliminar') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            ventas_json(['exito' => false, 'mensaje' => 'Método no permitido.'], 405);
        }
        $in = ventas_body();
        $id = (int)($in['id_producto'] ?? 0);
        if ($id <= 0) throw new InvalidArgumentException('ID de producto inválido.');

        $st = $pdo->prepare('SELECT COUNT(*) FROM ventas_orden_items WHERE id_producto = :id');
        $st->execute([':id' => $id]);
        if ((int)$st->fetchColumn() > 0) {
            throw new RuntimeException('No se puede eliminar este producto porque ya tiene ventas registradas. Usá el botón de dar de baja para ocultarlo.');
        }

        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare('UPDATE ventas_campanias SET id_producto_principal = NULL, activo = 0, visible_menu = 0 WHERE id_producto_principal = :id');
            $st->execute([':id' => $id]);

            $st = $pdo->prepare('DELETE FROM ventas_productos WHERE id_producto = :id LIMIT 1');
            $st->execute([':id' => $id]);

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        ventas_json(['exito' => true, 'mensaje' => 'Producto eliminado correctamente.']);
    }

    ventas_json(['exito' => false, 'mensaje' => 'Acción de productos no válida.'], 404);
} catch (Throwable $e) {
    ventas_json(['exito' => false, 'mensaje' => $e->getMessage()], 200);
}
