<?php
// backend/modules/ventas/ordenes.php
// Lista, agrega y edita ventas registradas. Una venta se guarda como cabecera en ventas_ordenes
// y sus columnas/conceptos tipo Excel (VEN, GAN, etc.) se guardan en ventas_orden_items.

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

function ventas_producto_por_id(PDO $pdo, int $idProducto): ?array {
    if ($idProducto <= 0) return null;
    $st = $pdo->prepare('SELECT id_producto, nombre, precio, COALESCE(precio_anticipada, precio) AS precio_anticipada, COALESCE(precio_puerta, precio_anticipada, precio) AS precio_puerta, activo FROM ventas_productos WHERE id_producto = :id LIMIT 1');
    $st->execute([':id' => $idProducto]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function ventas_tipo_precio_producto($value): string {
    return strtolower(trim((string)($value ?? 'anticipada'))) === 'puerta' ? 'puerta' : 'anticipada';
}

function ventas_precio_producto_por_tipo(?array $producto, string $tipo): float {
    if (!$producto) return 0.0;
    $tipo = ventas_tipo_precio_producto($tipo);
    if ($tipo === 'puerta') {
        return ventas_decimal($producto['precio_puerta'] ?? ($producto['precio_anticipada'] ?? ($producto['precio'] ?? 0)));
    }
    return ventas_decimal($producto['precio_anticipada'] ?? ($producto['precio'] ?? 0));
}

function ventas_metadata_item_precio($metadataRaw, string $precioTipo, ?array $productoDb): string {
    $metadata = [];

    if (is_string($metadataRaw) && trim($metadataRaw) !== '') {
        $decoded = json_decode($metadataRaw, true);
        if (is_array($decoded)) $metadata = $decoded;
    } elseif (is_array($metadataRaw)) {
        $metadata = $metadataRaw;
    }

    $metadata['precio_tipo'] = ventas_tipo_precio_producto($precioTipo);
    $metadata['precio_label'] = $metadata['precio_tipo'] === 'puerta' ? 'En puerta' : 'Anticipada';

    if ($productoDb) {
        $metadata['precio_anticipada_catalogo'] = ventas_decimal($productoDb['precio_anticipada'] ?? ($productoDb['precio'] ?? 0));
        $metadata['precio_puerta_catalogo'] = ventas_decimal($productoDb['precio_puerta'] ?? ($productoDb['precio_anticipada'] ?? ($productoDb['precio'] ?? 0)));
    }

    return json_encode($metadata, JSON_UNESCAPED_UNICODE);
}

function ventas_normalizar_items_orden(PDO $pdo, array $in, array $campania): array {
    $rawItems = $in['items'] ?? null;
    $itemsInput = [];

    if (is_array($rawItems)) {
        $itemsInput = array_values($rawItems);
    }

    // Compatibilidad con la versión anterior: si viene cantidad simple, la convertimos a un item VEN.
    if (!$itemsInput) {
        $itemsInput[] = [
            'id_producto' => $in['id_producto'] ?? ($campania['id_producto'] ?? 0),
            'producto_nombre' => $in['producto_nombre'] ?? ($campania['producto_nombre'] ?? ''),
            'columna_codigo' => 'VEN',
            'columna_nombre' => 'Venta',
            'cantidad' => $in['cantidad'] ?? 1,
            'precio_unitario' => $in['precio_unitario'] ?? ($campania['producto_precio'] ?? 0),
        ];
    }

    $items = [];
    $orden = 1;

    foreach ($itemsInput as $idx => $item) {
        if (!is_array($item)) continue;

        $cantidad = (int)($item['cantidad'] ?? 0);
        if ($cantidad <= 0) continue;

        $idProducto = (int)($item['id_producto'] ?? 0);
        $productoDb = ventas_producto_por_id($pdo, $idProducto);
        if ($idProducto > 0 && !$productoDb) {
            throw new InvalidArgumentException('Uno de los productos/conceptos seleccionados no existe.');
        }

        $productoNombre = $productoDb
            ? ventas_text($productoDb['nombre'] ?? '', 150, false)
            : ventas_text($item['producto_nombre'] ?? '', 150, false);

        if ($productoNombre === '') {
            throw new InvalidArgumentException('Cada concepto de la venta debe tener producto o nombre.');
        }

        $precioTipo = ventas_tipo_precio_producto($item['precio_tipo'] ?? 'anticipada');
        $precioUnitario = array_key_exists('precio_unitario', $item) && $item['precio_unitario'] !== ''
            ? ventas_decimal($item['precio_unitario'])
            : ventas_precio_producto_por_tipo($productoDb, $precioTipo);

        if ($precioUnitario < 0) {
            throw new InvalidArgumentException('El precio unitario no puede ser negativo.');
        }

        $codigoDefault = $idx === 0 ? 'VEN' : 'ITEM';
        $codigo = ventas_text($item['columna_codigo'] ?? $codigoDefault, 30, true);
        if ($codigo === '') $codigo = $codigoDefault;

        $nombreColumna = ventas_nullable_text($item['columna_nombre'] ?? $productoNombre, 120, false);
        $subtotal = round($cantidad * $precioUnitario, 2);

        $metadataRaw = $item['metadata_json'] ?? ($item['metadata'] ?? null);
        $metadata = ventas_metadata_item_precio($metadataRaw, $precioTipo, $productoDb);

        $items[] = [
            'id_producto' => $productoDb ? (int)$productoDb['id_producto'] : null,
            'producto_nombre' => $productoNombre,
            'columna_codigo' => $codigo,
            'columna_nombre' => $nombreColumna,
            'orden_columna' => $orden,
            'cantidad' => $cantidad,
            'precio_unitario' => $precioUnitario,
            'subtotal' => $subtotal,
            'metadata_json' => $metadata,
        ];

        $orden++;
    }

    if (!$items) {
        throw new InvalidArgumentException('Cargá al menos un concepto con cantidad mayor a cero.');
    }

    return $items;
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

    if ($action === 'ventas_personas_catalogo') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
            ventas_json(['exito' => false, 'mensaje' => 'Método no permitido.'], 405);
        }

        $q = ventas_text($_GET['q'] ?? '', 120, false);
        $like = '%' . $q . '%';

        $whereAlumnos = "WHERE a.num_documento IS NOT NULL AND TRIM(a.num_documento) <> ''";
        $paramsAlumnos = [];
        if ($q !== '') {
            $whereAlumnos .= " AND (a.apellido LIKE :q OR a.nombre LIKE :q OR a.num_documento LIKE :q OR an.`nombre_año` LIKE :q OR d.nombre_division LIKE :q)";
            $paramsAlumnos[':q'] = $like;
        }

        $stAlumnos = $pdo->prepare(" 
            SELECT
                a.id_alumno,
                a.apellido,
                a.nombre,
                a.num_documento AS dni,
                a.telefono,
                a.activo,
                an.`nombre_año`,
                d.nombre_division
            FROM alumnos a
            LEFT JOIN anio an ON an.`id_año` = a.`id_año`
            LEFT JOIN division d ON d.id_division = a.id_division
            $whereAlumnos
            ORDER BY a.activo DESC, a.apellido ASC, a.nombre ASC, a.id_alumno ASC
            LIMIT 5000
        ");
        $stAlumnos->execute($paramsAlumnos);
        $alumnos = $stAlumnos->fetchAll(PDO::FETCH_ASSOC);

        $wherePersonas = "WHERE vp.dni IS NOT NULL AND TRIM(vp.dni) <> ''";
        $paramsPersonas = [];
        if ($q !== '') {
            $wherePersonas .= " AND (vp.nombre_apellido LIKE :q OR vp.dni LIKE :q OR vp.origen LIKE :q OR vp.observacion LIKE :q)";
            $paramsPersonas[':q'] = $like;
        }

        $stPersonas = $pdo->prepare(" 
            SELECT
                vp.id_persona,
                vp.dni,
                vp.nombre_apellido,
                vp.id_alumno,
                vp.origen,
                vp.observacion,
                vp.actualizado_en
            FROM ventas_personas vp
            $wherePersonas
            ORDER BY vp.actualizado_en DESC, vp.nombre_apellido ASC, vp.id_persona DESC
            LIMIT 5000
        ");
        $stPersonas->execute($paramsPersonas);
        $personas = $stPersonas->fetchAll(PDO::FETCH_ASSOC);

        ventas_json([
            'exito' => true,
            'alumnos' => $alumnos,
            'personas' => $personas,
        ]);
    }

    if ($action === 'ventas_ordenes' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
        $idCampania = isset($_GET['id_campania']) ? (int)$_GET['id_campania'] : 0;
        $estado = ventas_text($_GET['estado'] ?? '', 30, false);
        $retiro = ventas_text($_GET['retiro'] ?? '', 30, false);
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
        if ($retiro === 'pendiente') {
            $where[] = '(o.retirado IS NULL OR o.retirado = 0)';
        } elseif ($retiro === 'retirado') {
            $where[] = 'o.retirado = 1';
        }
        if ($q !== '') {
            $where[] = '(
                o.codigo_orden LIKE :q
                OR o.persona_nombre LIKE :q
                OR o.persona_detalle LIKE :q
                OR o.persona_dni LIKE :q
                OR o.comprador_telefono LIKE :q
                OR o.payment_id LIKE :q
                OR mp.medio_pago LIKE :q
                OR EXISTS (
                    SELECT 1
                    FROM ventas_orden_items qi
                    WHERE qi.id_orden = o.id_orden
                      AND (qi.producto_nombre LIKE :q OR qi.columna_codigo LIKE :q OR qi.columna_nombre LIKE :q)
                )
            )';
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
                i.columna_codigo,
                i.columna_nombre,
                i.cantidad,
                i.precio_unitario,
                (SELECT COUNT(*) FROM ventas_orden_items ix WHERE ix.id_orden = o.id_orden) AS items_cantidad,
                (
                    SELECT GROUP_CONCAT(
                        CONCAT(
                            COALESCE(NULLIF(ix.columna_codigo, ''), ix.producto_nombre),
                            ' x', ix.cantidad
                        )
                        ORDER BY ix.orden_columna ASC, ix.id_item ASC
                        SEPARATOR ' · '
                    )
                    FROM ventas_orden_items ix
                    WHERE ix.id_orden = o.id_orden
                ) AS items_resumen
            FROM ventas_ordenes o
            LEFT JOIN ventas_campanias c ON c.id_campania = o.id_campania
            LEFT JOIN medio_pago mp ON mp.id_medio_pago = o.id_medio_pago
            LEFT JOIN ventas_orden_items i ON i.id_item = (
                SELECT ii.id_item
                FROM ventas_orden_items ii
                WHERE ii.id_orden = o.id_orden
                ORDER BY ii.orden_columna ASC, ii.id_item ASC
                LIMIT 1
            )
            $whereSql
            ORDER BY o.id_orden DESC
            LIMIT 300
        ";

        $st = $pdo->prepare($sql);
        $st->execute($params);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);

        $ids = array_values(array_filter(array_map(static fn($r) => (int)($r['id_orden'] ?? 0), $rows)));
        if ($ids) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $stItems = $pdo->prepare("
                SELECT
                    id_item,
                    id_orden,
                    id_producto,
                    producto_nombre,
                    columna_codigo,
                    columna_nombre,
                    orden_columna,
                    cantidad,
                    precio_unitario,
                    subtotal,
                    metadata_json
                FROM ventas_orden_items
                WHERE id_orden IN ($placeholders)
                ORDER BY id_orden DESC, orden_columna ASC, id_item ASC
            ");
            $stItems->execute($ids);
            $itemsByOrden = [];
            foreach ($stItems->fetchAll(PDO::FETCH_ASSOC) as $it) {
                $itemsByOrden[(int)$it['id_orden']][] = $it;
            }
            foreach ($rows as &$row) {
                $row['items'] = $itemsByOrden[(int)$row['id_orden']] ?? [];
            }
            unset($row);
        }

        ventas_json(['exito' => true, 'items' => $rows]);
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

    if ($action === 'ventas_orden_eliminar') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            ventas_json(['exito' => false, 'mensaje' => 'Método no permitido.'], 405);
        }

        $in = ventas_body();
        $idOrden = (int)($in['id_orden'] ?? 0);

        if ($idOrden <= 0) {
            throw new InvalidArgumentException('No se recibió la venta a eliminar.');
        }

        $st = $pdo->prepare('SELECT id_orden FROM ventas_ordenes WHERE id_orden = :id LIMIT 1');
        $st->execute([':id' => $idOrden]);
        if (!$st->fetchColumn()) {
            throw new InvalidArgumentException('La venta registrada no existe o ya fue eliminada.');
        }

        $pdo->beginTransaction();
        try {
            $st = $pdo->prepare('DELETE FROM ventas_orden_items WHERE id_orden = :id_orden');
            $st->execute([':id_orden' => $idOrden]);

            $st = $pdo->prepare('DELETE FROM ventas_ordenes WHERE id_orden = :id_orden LIMIT 1');
            $st->execute([':id_orden' => $idOrden]);

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        ventas_json(['exito' => true, 'mensaje' => 'Venta eliminada correctamente.']);
    }

    if ($action === 'ventas_orden_guardar') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            ventas_json(['exito' => false, 'mensaje' => 'Método no permitido.'], 405);
        }

        $in = ventas_body();
        $idOrden = (int)($in['id_orden'] ?? 0);
        $idCampania = (int)($in['id_campania'] ?? 0);
        $idMedioPago = (int)($in['id_medio_pago'] ?? 0);
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
                COALESCE(p.precio_anticipada, p.precio) AS producto_precio,
                COALESCE(p.precio_anticipada, p.precio) AS producto_precio_anticipada,
                COALESCE(p.precio_puerta, p.precio_anticipada, p.precio) AS producto_precio_puerta
            FROM ventas_campanias c
            LEFT JOIN ventas_productos p ON p.id_producto = c.id_producto_principal
            WHERE c.id_campania = :id
            LIMIT 1
        ");
        $st->execute([':id' => $idCampania]);
        $campania = $st->fetch(PDO::FETCH_ASSOC);
        if (!$campania) throw new InvalidArgumentException('La venta seleccionada no existe.');

        $personaDni = ventas_normalizar_dni($in['persona_dni'] ?? ($in['dni'] ?? ''));
        $personaNombre = ventas_text($in['persona_nombre'] ?? '', 160, true);
        $personaDetalle = ventas_nullable_text($in['persona_detalle'] ?? '', 160, true);
        $telefono = ventas_nullable_text($in['comprador_telefono'] ?? '', 40, false);
        $observacion = ventas_nullable_text($in['observacion'] ?? '', 5000, false);

        if ($personaDni === '' || strlen($personaDni) < 6) {
            throw new InvalidArgumentException('Ingresá el DNI de la persona/alumno, solo números, con mínimo 6 dígitos.');
        }

        $personaVenta = ventas_resolver_persona_venta($pdo, $personaDni, $personaNombre, $telefono, 'manual');
        $idVentaPersona = (int)($personaVenta['id_persona'] ?? 0);
        $idAlumnoPersona = (int)($personaVenta['id_alumno'] ?? 0);
        $personaNombre = ventas_text($personaVenta['nombre_apellido'] ?? $personaNombre, 160, true);

        if ($personaNombre === '') throw new InvalidArgumentException('Ingresá el nombre informado para la venta.');
        if ($personaDetalle === null || $personaDetalle === '') {
            $personaDetalle = 'DNI: ' . $personaDni . ($idAlumnoPersona > 0 ? ' | Alumno ID: ' . $idAlumnoPersona : '');
        }

        $items = ventas_normalizar_items_orden($pdo, $in, $campania);
        $total = round(array_sum(array_map(static fn($it) => (float)$it['subtotal'], $items)), 2);
        if ($total <= 0) throw new InvalidArgumentException('El total de la venta debe ser mayor a cero.');

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
                        id_venta_persona = :id_venta_persona,
                        persona_dni = :persona_dni,
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
                    ':persona_tipo' => 'vendedor',
                    ':persona_nombre' => $personaNombre,
                    ':persona_detalle' => $personaDetalle,
                    ':id_venta_persona' => $idVentaPersona > 0 ? $idVentaPersona : null,
                    ':persona_dni' => $personaDni,
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
                     id_venta_persona, persona_dni, estado, id_medio_pago, total, mp_status, origen, observacion, creado_en, aprobado_en, cancelado_en)
                    VALUES
                    (:codigo_orden, :id_campania, :comprador_telefono, :persona_tipo, :persona_nombre, :persona_detalle,
                     :id_venta_persona, :persona_dni, :estado, :id_medio_pago, :total, :mp_status, 'manual', :observacion, :creado_en, :aprobado_en, :cancelado_en)
                ");
                $st->execute([
                    ':codigo_orden' => $codigo,
                    ':id_campania' => $idCampania,
                    ':comprador_telefono' => $telefono,
                    ':persona_tipo' => 'vendedor',
                    ':persona_nombre' => $personaNombre,
                    ':persona_detalle' => $personaDetalle,
                    ':id_venta_persona' => $idVentaPersona > 0 ? $idVentaPersona : null,
                    ':persona_dni' => $personaDni,
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

            $stItem = $pdo->prepare(" 
                INSERT INTO ventas_orden_items
                (id_orden, id_producto, producto_nombre, columna_codigo, columna_nombre, orden_columna,
                 cantidad, precio_unitario, subtotal, metadata_json)
                VALUES
                (:id_orden, :id_producto, :producto_nombre, :columna_codigo, :columna_nombre, :orden_columna,
                 :cantidad, :precio_unitario, :subtotal, :metadata_json)
            ");

            foreach ($items as $item) {
                $stItem->execute([
                    ':id_orden' => $idOrden,
                    ':id_producto' => $item['id_producto'],
                    ':producto_nombre' => $item['producto_nombre'],
                    ':columna_codigo' => $item['columna_codigo'],
                    ':columna_nombre' => $item['columna_nombre'],
                    ':orden_columna' => $item['orden_columna'],
                    ':cantidad' => $item['cantidad'],
                    ':precio_unitario' => $item['precio_unitario'],
                    ':subtotal' => $item['subtotal'],
                    ':metadata_json' => $item['metadata_json'],
                ]);
            }

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
