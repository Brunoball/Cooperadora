<?php
// backend/modules/ventas/helpers.php
// Helpers del módulo Ventas Escolares.

function ventas_json($payload, $code = 200) {
    http_response_code((int)$code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function ventas_pdo() {
    if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
        $GLOBALS['pdo']->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $GLOBALS['pdo']->exec('SET NAMES utf8mb4');
        return $GLOBALS['pdo'];
    }

    $dbFile = __DIR__ . '/../../config/db.php';
    if (!is_file($dbFile)) {
        throw new RuntimeException('No se encontró el archivo de conexión: backend/config/db.php');
    }

    require $dbFile;

    if (!isset($pdo) || !($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible. Revisá backend/config/db.php: debe crear una variable $pdo con instancia PDO.');
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('SET NAMES utf8mb4');
    $GLOBALS['pdo'] = $pdo;

    return $pdo;
}

function ventas_body() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);

    if (!is_array($data)) {
        $data = $_POST ?: array();
    }

    return $data;
}

function ventas_bool($value, $default = 0) {
    if ($value === null || $value === '') return $default ? 1 : 0;
    if (is_bool($value)) return $value ? 1 : 0;
    if (is_numeric($value)) return ((int)$value) ? 1 : 0;

    $v = strtolower(trim((string)$value));
    return in_array($v, array('1', 'true', 'si', 'sí', 'yes', 'on'), true) ? 1 : 0;
}

function ventas_text($value, $max = 255, $upper = false) {
    $txt = trim((string)($value ?? ''));
    $txt = preg_replace('/\s+/u', ' ', $txt);
    if ($txt === null) $txt = '';
    if ($upper) $txt = mb_strtoupper($txt, 'UTF-8');
    if (mb_strlen($txt, 'UTF-8') > (int)$max) {
        $txt = mb_substr($txt, 0, (int)$max, 'UTF-8');
    }
    return $txt;
}

function ventas_nullable_text($value, $max = 255, $upper = false) {
    $txt = ventas_text($value, $max, $upper);
    return $txt === '' ? null : $txt;
}

function ventas_decimal($value) {
    if ($value === null || $value === '') return 0.0;
    if (is_numeric($value)) return round((float)$value, 2);

    $s = trim((string)$value);
    $s = str_replace(array('$', ' '), '', $s);
    if (strpos($s, ',') !== false) {
        $s = str_replace('.', '', $s);
        $s = str_replace(',', '.', $s);
    } else {
        $s = str_replace(',', '', $s);
    }

    return is_numeric($s) ? round((float)$s, 2) : 0.0;
}

function ventas_date_or_null($value) {
    $v = trim((string)($value ?? ''));
    if ($v === '') return null;
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) return null;
    $parts = explode('-', $v);
    $y = (int)$parts[0];
    $m = (int)$parts[1];
    $d = (int)$parts[2];
    return checkdate($m, $d, $y) ? sprintf('%04d-%02d-%02d', $y, $m, $d) : null;
}

function ventas_column_exists($pdo, $table, $column) {
    $st = $pdo->prepare("SHOW COLUMNS FROM `$table` LIKE :column");
    $st->execute(array(':column' => $column));
    return $st->fetch(PDO::FETCH_ASSOC) ?: null;
}

function ventas_foreign_key_for_column($pdo, $table, $column) {
    $sql = "
        SELECT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = :table_name
          AND COLUMN_NAME = :column_name
          AND REFERENCED_TABLE_NAME IS NOT NULL
        LIMIT 1
    ";
    $st = $pdo->prepare($sql);
    $st->execute(array(':table_name' => $table, ':column_name' => $column));
    $name = $st->fetchColumn();
    return $name ? (string)$name : null;
}

function ventas_index_exists($pdo, $table, $indexName) {
    $st = $pdo->prepare("SHOW INDEX FROM `$table` WHERE Key_name = :idx");
    $st->execute(array(':idx' => $indexName));
    return (bool)$st->fetch(PDO::FETCH_ASSOC);
}

function ventas_constraint_exists($pdo, $table, $constraintName) {
    $sql = "
        SELECT 1
        FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = :table_name
          AND CONSTRAINT_NAME = :constraint_name
        LIMIT 1
    ";
    $st = $pdo->prepare($sql);
    $st->execute(array(':table_name' => $table, ':constraint_name' => $constraintName));
    return (bool)$st->fetchColumn();
}


function ventas_table_exists($pdo, $table) {
    try {
        $st = $pdo->prepare("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name LIMIT 1");
        $st->execute(array(':table_name' => $table));
        return (bool)$st->fetchColumn();
    } catch (Throwable $e) {
        return false;
    }
}

function ventas_contable_recortar($value, $max) {
    $txt = trim((string)($value ?? ''));
    $txt = preg_replace('/\s+/u', ' ', $txt);
    if ($txt === '') return '';
    return mb_strlen($txt, 'UTF-8') > (int)$max ? mb_substr($txt, 0, (int)$max, 'UTF-8') : $txt;
}

function ventas_contable_asegurar_tablas($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS contable_categoria (
        id_cont_categoria INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nombre_categoria VARCHAR(120) NOT NULL,
        fecha_creacion DATE NOT NULL DEFAULT (CURRENT_DATE),
        PRIMARY KEY (id_cont_categoria),
        UNIQUE KEY uk_contable_categoria_nombre (nombre_categoria)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS contable_descripcion (
        id_cont_descripcion INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nombre_descripcion VARCHAR(160) NOT NULL,
        fecha_creacion DATE NOT NULL DEFAULT (CURRENT_DATE),
        PRIMARY KEY (id_cont_descripcion),
        UNIQUE KEY uk_contable_descripcion_nombre (nombre_descripcion)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS contable_proveedor (
        id_cont_proveedor INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nombre_proveedor VARCHAR(120) NOT NULL,
        fecha_creacion DATE NOT NULL DEFAULT (CURRENT_DATE),
        PRIMARY KEY (id_cont_proveedor),
        UNIQUE KEY uk_contable_proveedor_nombre (nombre_proveedor)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS ingresos (
        id_ingreso INT UNSIGNED NOT NULL AUTO_INCREMENT,
        fecha DATE NOT NULL,
        id_cont_categoria INT UNSIGNED NULL DEFAULT NULL,
        id_cont_proveedor INT UNSIGNED NULL DEFAULT NULL,
        id_cont_descripcion INT UNSIGNED NULL DEFAULT NULL,
        id_medio_pago INT UNSIGNED NULL DEFAULT NULL,
        importe DECIMAL(12,2) UNSIGNED NOT NULL,
        PRIMARY KEY (id_ingreso),
        KEY idx_ingresos_categoria (id_cont_categoria),
        KEY idx_ingresos_proveedor (id_cont_proveedor),
        KEY idx_ingresos_descripcion (id_cont_descripcion),
        KEY idx_ingresos_medio_pago (id_medio_pago)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    if (!ventas_column_exists($pdo, 'ventas_ordenes', 'id_ingreso')) {
        $after = ventas_column_exists($pdo, 'ventas_ordenes', 'retirado_en') ? ' AFTER retirado_en' : '';
        $pdo->exec("ALTER TABLE ventas_ordenes ADD COLUMN id_ingreso INT UNSIGNED NULL DEFAULT NULL" . $after);
    }

    // Permite borrar el impacto contable de una venta desde Contable sin que se vuelva a crear automáticamente.
    if (!ventas_column_exists($pdo, 'ventas_ordenes', 'contable_excluido')) {
        $after = ventas_column_exists($pdo, 'ventas_ordenes', 'id_ingreso') ? ' AFTER id_ingreso' : '';
        $pdo->exec("ALTER TABLE ventas_ordenes ADD COLUMN contable_excluido TINYINT(1) NOT NULL DEFAULT 0" . $after);
    }

    if (!ventas_index_exists($pdo, 'ventas_ordenes', 'idx_ventas_ordenes_ingreso')) {
        try {
            $pdo->exec("ALTER TABLE ventas_ordenes ADD KEY idx_ventas_ordenes_ingreso (id_ingreso)");
        } catch (Throwable $e) {
            // El índice no es obligatorio para operar.
        }
    }
}

function ventas_contable_get_or_create(PDO $pdo, string $table, string $idColumn, string $nameColumn, string $name): ?int {
    $name = ventas_contable_recortar($name, $table === 'contable_descripcion' ? 160 : 120);
    if ($name === '') return null;

    $st = $pdo->prepare("SELECT `$idColumn` FROM `$table` WHERE `$nameColumn` = :name LIMIT 1");
    $st->execute(array(':name' => $name));
    $id = (int)($st->fetchColumn() ?: 0);
    if ($id > 0) return $id;

    $st = $pdo->prepare("INSERT INTO `$table` (`$nameColumn`) VALUES (:name) ON DUPLICATE KEY UPDATE `$idColumn` = LAST_INSERT_ID(`$idColumn`)");
    $st->execute(array(':name' => $name));
    $id = (int)$pdo->lastInsertId();
    if ($id > 0) return $id;

    $st = $pdo->prepare("SELECT `$idColumn` FROM `$table` WHERE `$nameColumn` = :name LIMIT 1");
    $st->execute(array(':name' => $name));
    $id = (int)($st->fetchColumn() ?: 0);
    return $id > 0 ? $id : null;
}

function ventas_contable_resumen_items(PDO $pdo, int $idOrden): string {
    try {
        $st = $pdo->prepare("\n            SELECT GROUP_CONCAT(\n                CONCAT(\n                    COALESCE(NULLIF(producto_nombre, ''), NULLIF(columna_nombre, ''), NULLIF(columna_codigo, ''), 'Concepto'),\n                    ' x', cantidad\n                )\n                ORDER BY orden_columna ASC, id_item ASC\n                SEPARATOR ' · '\n            ) AS resumen\n            FROM ventas_orden_items\n            WHERE id_orden = :id\n        ");
        $st->execute(array(':id' => $idOrden));
        return ventas_contable_recortar((string)($st->fetchColumn() ?: ''), 90);
    } catch (Throwable $e) {
        return '';
    }
}

function ventas_contable_eliminar_ingreso_vinculado(PDO $pdo, int $idOrden): void {
    if ($idOrden <= 0 || !ventas_table_exists($pdo, 'ventas_ordenes') || !ventas_column_exists($pdo, 'ventas_ordenes', 'id_ingreso')) {
        return;
    }

    $st = $pdo->prepare('SELECT id_ingreso FROM ventas_ordenes WHERE id_orden = :id LIMIT 1');
    $st->execute(array(':id' => $idOrden));
    $idIngreso = (int)($st->fetchColumn() ?: 0);
    if ($idIngreso <= 0) return;

    $pdo->prepare('UPDATE ventas_ordenes SET id_ingreso = NULL WHERE id_orden = :id LIMIT 1')->execute(array(':id' => $idOrden));
    $pdo->prepare('DELETE FROM ingresos WHERE id_ingreso = :id LIMIT 1')->execute(array(':id' => $idIngreso));
}

function ventas_contable_bind_nullable_int(PDOStatement $st, string $param, ?int $value): void {
    if ($value === null || $value <= 0) {
        $st->bindValue($param, null, PDO::PARAM_NULL);
    } else {
        $st->bindValue($param, $value, PDO::PARAM_INT);
    }
}

function ventas_contable_buscar_ingreso_actual(PDO $pdo, string $fecha, float $total, int $idMedioPago, ?int $idCategoria, ?int $idProveedor, ?int $idDescripcion): int {
    $buscar = $pdo->prepare("\n        SELECT id_ingreso\n        FROM ingresos\n        WHERE fecha = :fecha\n          AND importe = :importe\n          AND id_medio_pago <=> :medio\n          AND id_cont_categoria <=> :categoria\n          AND id_cont_proveedor <=> :proveedor\n          AND id_cont_descripcion <=> :descripcion\n        ORDER BY id_ingreso DESC\n        LIMIT 1\n    ");
    $buscar->bindValue(':fecha', $fecha, PDO::PARAM_STR);
    $buscar->bindValue(':importe', number_format($total, 2, '.', ''), PDO::PARAM_STR);
    ventas_contable_bind_nullable_int($buscar, ':medio', $idMedioPago);
    ventas_contable_bind_nullable_int($buscar, ':categoria', $idCategoria);
    ventas_contable_bind_nullable_int($buscar, ':proveedor', $idProveedor);
    ventas_contable_bind_nullable_int($buscar, ':descripcion', $idDescripcion);
    $buscar->execute();
    return (int)($buscar->fetchColumn() ?: 0);
}

function ventas_contable_legacy_patterns(string $codigo, string $campania, int $idOrden): array {
    $patterns = array();

    $codigo = ventas_contable_recortar($codigo, 60);
    if ($codigo !== '') {
        // Versiones anteriores dejaban la imputación como "Venta MAN-..." / "Venta BOT-...".
        $patterns[] = array('like', 'Venta ' . $codigo . '%');
        $patterns[] = array('like', 'VENTA ' . $codigo . '%');
    }

    if ($idOrden > 0) {
        $patterns[] = array('like', 'Venta #' . $idOrden . '%');
        $patterns[] = array('like', 'VENTA #' . $idOrden . '%');
    }

    $campania = ventas_contable_recortar($campania, 100);
    if ($campania !== '') {
        // Otra versión intermedia usaba "Ingreso por venta - Nombre de venta - ...".
        $patterns[] = array('like', 'Ingreso por venta - ' . $campania . '%');
        $patterns[] = array('like', 'INGRESO POR VENTA - ' . $campania . '%');
    }

    // Versión intermedia errónea solicitada antes: todos quedaban como VENTA X.
    $patterns[] = array('eq', 'VENTA X');
    $patterns[] = array('eq', 'Ingreso por venta escolar');

    return $patterns;
}

function ventas_contable_buscar_ingreso_legacy(PDO $pdo, string $fecha, float $total, int $idMedioPago, ?int $idCategoria, ?int $idProveedor, string $codigo, string $campania, int $idOrden): int {
    $patterns = ventas_contable_legacy_patterns($codigo, $campania, $idOrden);
    if (!$patterns) return 0;

    $conds = array();
    $params = array();
    foreach ($patterns as $idx => $pattern) {
        [$type, $value] = $pattern;
        $key = ':p' . $idx;
        if ($type === 'like') {
            $conds[] = "d.nombre_descripcion LIKE $key";
        } else {
            $conds[] = "d.nombre_descripcion = $key";
        }
        $params[$key] = $value;
    }

    $sql = "\n        SELECT i.id_ingreso\n        FROM ingresos i\n        LEFT JOIN contable_descripcion d ON d.id_cont_descripcion = i.id_cont_descripcion\n        LEFT JOIN ventas_ordenes ov ON ov.id_ingreso = i.id_ingreso\n        WHERE i.fecha = :fecha\n          AND i.importe = :importe\n          AND i.id_medio_pago <=> :medio\n          AND i.id_cont_categoria <=> :categoria\n          AND i.id_cont_proveedor <=> :proveedor\n          AND ov.id_orden IS NULL\n          AND (" . implode(' OR ', $conds) . ")\n        ORDER BY i.id_ingreso DESC\n        LIMIT 1\n    ";

    $st = $pdo->prepare($sql);
    $st->bindValue(':fecha', $fecha, PDO::PARAM_STR);
    $st->bindValue(':importe', number_format($total, 2, '.', ''), PDO::PARAM_STR);
    ventas_contable_bind_nullable_int($st, ':medio', $idMedioPago);
    ventas_contable_bind_nullable_int($st, ':categoria', $idCategoria);
    ventas_contable_bind_nullable_int($st, ':proveedor', $idProveedor);
    foreach ($params as $key => $value) {
        $st->bindValue($key, $value, PDO::PARAM_STR);
    }
    $st->execute();
    return (int)($st->fetchColumn() ?: 0);
}

function ventas_contable_limpiar_duplicados_legacy(PDO $pdo, int $idIngresoActual, string $fecha, float $total, int $idMedioPago, ?int $idCategoria, ?int $idProveedor, string $codigo, string $campania, int $idOrden): void {
    if ($idIngresoActual <= 0) return;

    $patterns = ventas_contable_legacy_patterns($codigo, $campania, $idOrden);
    if (!$patterns) return;

    $conds = array();
    $params = array();
    foreach ($patterns as $idx => $pattern) {
        [$type, $value] = $pattern;
        $key = ':p' . $idx;
        if ($type === 'like') {
            $conds[] = "d.nombre_descripcion LIKE $key";
        } else {
            $conds[] = "d.nombre_descripcion = $key";
        }
        $params[$key] = $value;
    }

    $sql = "\n        SELECT i.id_ingreso\n        FROM ingresos i\n        LEFT JOIN contable_descripcion d ON d.id_cont_descripcion = i.id_cont_descripcion\n        LEFT JOIN ventas_ordenes ov ON ov.id_ingreso = i.id_ingreso\n        WHERE i.id_ingreso <> :actual\n          AND i.fecha = :fecha\n          AND i.importe = :importe\n          AND i.id_medio_pago <=> :medio\n          AND i.id_cont_categoria <=> :categoria\n          AND i.id_cont_proveedor <=> :proveedor\n          AND ov.id_orden IS NULL\n          AND (" . implode(' OR ', $conds) . ")\n    ";

    $st = $pdo->prepare($sql);
    $st->bindValue(':actual', $idIngresoActual, PDO::PARAM_INT);
    $st->bindValue(':fecha', $fecha, PDO::PARAM_STR);
    $st->bindValue(':importe', number_format($total, 2, '.', ''), PDO::PARAM_STR);
    ventas_contable_bind_nullable_int($st, ':medio', $idMedioPago);
    ventas_contable_bind_nullable_int($st, ':categoria', $idCategoria);
    ventas_contable_bind_nullable_int($st, ':proveedor', $idProveedor);
    foreach ($params as $key => $value) {
        $st->bindValue($key, $value, PDO::PARAM_STR);
    }
    $st->execute();
    $ids = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));

    if (!$ids) return;

    $del = $pdo->prepare('DELETE FROM ingresos WHERE id_ingreso = :id LIMIT 1');
    foreach ($ids as $id) {
        if ($id > 0 && $id !== $idIngresoActual) {
            $del->execute(array(':id' => $id));
        }
    }
}

function ventas_sincronizar_orden_contable(PDO $pdo, int $idOrden): ?int {
    if ($idOrden <= 0 || !ventas_table_exists($pdo, 'ventas_ordenes')) return null;

    // IMPORTANTE: no ejecutar DDL (CREATE/ALTER) dentro de una transacción activa.
    // MySQL hace COMMIT implícito con DDL y eso provoca el error
    // "There is no active transaction" cuando luego se intenta $pdo->commit().
    // El esquema contable se prepara antes de abrir transacciones desde ventas_tablas_verificadas().
    if (!$pdo->inTransaction()) {
        ventas_contable_asegurar_tablas($pdo);
    }

    $st = $pdo->prepare("\n        SELECT\n            o.id_orden,\n            o.codigo_orden,\n            o.estado,\n            o.total,\n            o.id_medio_pago,\n            o.persona_nombre,\n            o.persona_detalle,\n            o.persona_dni,\n            o.creado_en,\n            o.aprobado_en,\n            o.id_ingreso,\n            COALESCE(o.contable_excluido, 0) AS contable_excluido,\n            c.nombre AS campania_nombre\n        FROM ventas_ordenes o\n        LEFT JOIN ventas_campanias c ON c.id_campania = o.id_campania\n        WHERE o.id_orden = :id\n        LIMIT 1\n    ");
    $st->execute(array(':id' => $idOrden));
    $orden = $st->fetch(PDO::FETCH_ASSOC);
    if (!$orden) return null;

    if ((int)($orden['contable_excluido'] ?? 0) === 1) {
        return null;
    }

    $estado = strtolower((string)($orden['estado'] ?? ''));
    $total = ventas_decimal($orden['total'] ?? 0);
    if ($estado !== 'aprobada' || $total <= 0) {
        ventas_contable_eliminar_ingreso_vinculado($pdo, $idOrden);
        return null;
    }

    $idMedioPago = (int)($orden['id_medio_pago'] ?? 0);
    if ($idMedioPago <= 0) {
        $idMedioPago = (int)($pdo->query('SELECT id_medio_pago FROM medio_pago ORDER BY id_medio_pago ASC LIMIT 1')->fetchColumn() ?: 0);
    }
    if ($idMedioPago <= 0) {
        throw new RuntimeException('No se pudo registrar la venta en contable porque no hay medios de pago cargados.');
    }

    $fechaBase = (string)($orden['aprobado_en'] ?: ($orden['creado_en'] ?: date('Y-m-d')));
    $fecha = substr($fechaBase, 0, 10);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) $fecha = date('Y-m-d');

    $codigo = ventas_contable_recortar((string)($orden['codigo_orden'] ?? ''), 60);
    $campania = ventas_contable_recortar((string)($orden['campania_nombre'] ?? ''), 80);
    $persona = ventas_contable_recortar((string)($orden['persona_nombre'] ?? ''), 100);
    if ($persona === '') $persona = 'VENTA SIN PERSONA';

    $detallePersona = ventas_contable_recortar((string)($orden['persona_detalle'] ?? ''), 80);
    $dni = ventas_normalizar_dni($orden['persona_dni'] ?? '');
    $items = ventas_contable_resumen_items($pdo, $idOrden);

    $categoriaNombre = 'VENTAS';
    $proveedorNombre = $persona;
    // Imputación limpia: VENTA + nombre de la venta/campaña.
    // Ejemplo: VENTA EJEMPLO - TALITAS / VENTA EJEMPLO - BAILE ESCOLAR.
    $campaniaImputacion = ventas_contable_recortar(mb_strtoupper($campania, 'UTF-8'), 150);
    $descripcionNombre = $campaniaImputacion !== '' ? ('VENTA ' . $campaniaImputacion) : 'VENTA';

    $idCategoria = ventas_contable_get_or_create($pdo, 'contable_categoria', 'id_cont_categoria', 'nombre_categoria', $categoriaNombre);
    $idProveedor = ventas_contable_get_or_create($pdo, 'contable_proveedor', 'id_cont_proveedor', 'nombre_proveedor', $proveedorNombre);
    $idDescripcion = ventas_contable_get_or_create($pdo, 'contable_descripcion', 'id_cont_descripcion', 'nombre_descripcion', $descripcionNombre);

    $idIngreso = (int)($orden['id_ingreso'] ?? 0);
    $existeIngreso = false;
    if ($idIngreso > 0) {
        $chk = $pdo->prepare('SELECT 1 FROM ingresos WHERE id_ingreso = :id LIMIT 1');
        $chk->execute(array(':id' => $idIngreso));
        $existeIngreso = (bool)$chk->fetchColumn();
    }

    if (!$existeIngreso) {
        // Primero intenta reutilizar el ingreso correcto actual.
        // Si ya se había generado con un texto viejo (por ejemplo "Venta MAN-..."), lo reutiliza
        // y lo actualiza, evitando que quede duplicado al cambiar la imputación a "VENTA NOMBRE".
        $idIngreso = ventas_contable_buscar_ingreso_actual(
            $pdo,
            $fecha,
            $total,
            $idMedioPago,
            $idCategoria,
            $idProveedor,
            $idDescripcion
        );

        if ($idIngreso <= 0) {
            $idIngreso = ventas_contable_buscar_ingreso_legacy(
                $pdo,
                $fecha,
                $total,
                $idMedioPago,
                $idCategoria,
                $idProveedor,
                $codigo,
                $campania,
                $idOrden
            );
        }

        $existeIngreso = $idIngreso > 0;
    }

    if ($existeIngreso) {
        $up = $pdo->prepare("\n            UPDATE ingresos\n            SET fecha = :fecha,\n                id_cont_categoria = :categoria,\n                id_cont_proveedor = :proveedor,\n                id_cont_descripcion = :descripcion,\n                id_medio_pago = :medio,\n                importe = :importe\n            WHERE id_ingreso = :id\n            LIMIT 1\n        ");
        $up->bindValue(':id', $idIngreso, PDO::PARAM_INT);
    } else {
        $up = $pdo->prepare("\n            INSERT INTO ingresos\n                (fecha, id_cont_categoria, id_cont_proveedor, id_cont_descripcion, id_medio_pago, importe)\n            VALUES\n                (:fecha, :categoria, :proveedor, :descripcion, :medio, :importe)\n        ");
    }

    $up->bindValue(':fecha', $fecha, PDO::PARAM_STR);
    if ($idCategoria === null) $up->bindValue(':categoria', null, PDO::PARAM_NULL);
    else $up->bindValue(':categoria', $idCategoria, PDO::PARAM_INT);
    if ($idProveedor === null) $up->bindValue(':proveedor', null, PDO::PARAM_NULL);
    else $up->bindValue(':proveedor', $idProveedor, PDO::PARAM_INT);
    if ($idDescripcion === null) $up->bindValue(':descripcion', null, PDO::PARAM_NULL);
    else $up->bindValue(':descripcion', $idDescripcion, PDO::PARAM_INT);
    $up->bindValue(':medio', $idMedioPago, PDO::PARAM_INT);
    $up->bindValue(':importe', number_format($total, 2, '.', ''), PDO::PARAM_STR);
    $up->execute();

    if (!$existeIngreso) {
        $idIngreso = (int)$pdo->lastInsertId();
    }

    if ($idIngreso > 0) {
        $stLink = $pdo->prepare('UPDATE ventas_ordenes SET id_ingreso = :ingreso WHERE id_orden = :orden LIMIT 1');
        $stLink->execute(array(':ingreso' => $idIngreso, ':orden' => $idOrden));

        // Limpia duplicados que quedaron de versiones anteriores del impacto contable.
        // Ejemplo real: una venta manual podía quedar dos veces, una como "Venta MAN-..."
        // y otra como "VENTA EL BAILABLE...".
        ventas_contable_limpiar_duplicados_legacy(
            $pdo,
            $idIngreso,
            $fecha,
            $total,
            $idMedioPago,
            $idCategoria,
            $idProveedor,
            $codigo,
            $campania,
            $idOrden
        );
    }

    return $idIngreso > 0 ? $idIngreso : null;
}

function ventas_sincronizar_contable_ventas_aprobadas(PDO $pdo): int {
    if (!ventas_table_exists($pdo, 'ventas_ordenes')) return 0;

    // Evita DDL dentro de una transacción activa. Ver comentario en ventas_sincronizar_orden_contable().
    if (!$pdo->inTransaction()) {
        ventas_contable_asegurar_tablas($pdo);
    }

    // Si una venta se canceló/quedó en cero, quitar su ingreso vinculado.
    // Si el ingreso fue borrado desde Contable, contable_excluido=1 evita que se regenere.
    $stCancelar = $pdo->query("\n        SELECT id_orden\n        FROM ventas_ordenes\n        WHERE id_ingreso IS NOT NULL\n          AND id_ingreso > 0\n          AND (estado <> 'aprobada' OR COALESCE(total, 0) <= 0 OR COALESCE(contable_excluido, 0) = 1)\n    ");
    foreach (array_map('intval', $stCancelar->fetchAll(PDO::FETCH_COLUMN)) as $idCancelar) {
        ventas_contable_eliminar_ingreso_vinculado($pdo, $idCancelar);
    }

    // Re-sincroniza todas las ventas aprobadas para que también se actualicen textos viejos de imputación.
    $st = $pdo->query("\n        SELECT o.id_orden\n        FROM ventas_ordenes o\n        LEFT JOIN ingresos i ON i.id_ingreso = o.id_ingreso\n        WHERE o.estado = 'aprobada'\n          AND COALESCE(o.total, 0) > 0\n          AND COALESCE(o.contable_excluido, 0) = 0\n        ORDER BY o.id_orden ASC\n    ");


    $ids = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
    $count = 0;
    foreach ($ids as $idOrden) {
        if ($idOrden > 0 && ventas_sincronizar_orden_contable($pdo, $idOrden) !== null) {
            $count++;
        }
    }

    return $count;
}

function ventas_asegurar_esquema_productos_independientes($pdo) {
    // Desde esta versión los productos son de catálogo global y la venta/campaña solo elige cuál vender.
    if (!ventas_column_exists($pdo, 'ventas_campanias', 'id_producto_principal')) {
        $pdo->exec("ALTER TABLE ventas_campanias ADD COLUMN id_producto_principal INT UNSIGNED NULL DEFAULT NULL AFTER visible_menu");
    }

    if (!ventas_index_exists($pdo, 'ventas_campanias', 'idx_ventas_campanias_producto')) {
        try {
            $pdo->exec("ALTER TABLE ventas_campanias ADD KEY idx_ventas_campanias_producto (id_producto_principal)");
        } catch (Throwable $e) {
            // El índice no es crítico si el motor lo creó automáticamente por la FK.
        }
    }

    $colCampaniaProducto = ventas_column_exists($pdo, 'ventas_productos', 'id_campania');

    // Compatibilidad con bases viejas: si todavía existe ventas_productos.id_campania,
    // primero migramos el producto principal de cada venta y luego dejamos esa columna nullable
    // para que el producto pueda cargarse sin estar atado a una venta.
    if ($colCampaniaProducto) {
        try {
            $pdo->exec("
                UPDATE ventas_campanias c
                SET c.id_producto_principal = (
                    SELECT p.id_producto
                    FROM ventas_productos p
                    WHERE p.id_campania = c.id_campania
                    ORDER BY p.activo DESC, p.id_producto ASC
                    LIMIT 1
                )
                WHERE c.id_producto_principal IS NULL
                  AND EXISTS (SELECT 1 FROM ventas_productos p2 WHERE p2.id_campania = c.id_campania)
            ");
        } catch (Throwable $e) {
            // Si la columna legacy existe pero no puede consultarse por una diferencia de esquema,
            // no bloqueamos todo el módulo: el usuario puede ejecutar el SQL de limpieza incluido.
        }

        if (strtoupper((string)($colCampaniaProducto['Null'] ?? 'NO')) === 'NO') {
            try {
                $fk = ventas_foreign_key_for_column($pdo, 'ventas_productos', 'id_campania');
                if ($fk) {
                    $pdo->exec("ALTER TABLE ventas_productos DROP FOREIGN KEY `$fk`");
                }

                $pdo->exec("ALTER TABLE ventas_productos MODIFY id_campania INT UNSIGNED NULL DEFAULT NULL");

                if (!ventas_foreign_key_for_column($pdo, 'ventas_productos', 'id_campania')) {
                    $pdo->exec("ALTER TABLE ventas_productos ADD CONSTRAINT fk_ventas_productos_campania FOREIGN KEY (id_campania) REFERENCES ventas_campanias (id_campania) ON DELETE SET NULL ON UPDATE CASCADE");
                }
            } catch (Throwable $e) {
                throw new RuntimeException('La base necesita actualizar el módulo Ventas para productos independientes. Ejecutá el SQL de limpieza/migración indicado. Detalle: ' . $e->getMessage());
            }
        }
    }

    if (!ventas_constraint_exists($pdo, 'ventas_campanias', 'fk_ventas_campanias_producto_principal')) {
        try {
            $pdo->exec("ALTER TABLE ventas_campanias ADD CONSTRAINT fk_ventas_campanias_producto_principal FOREIGN KEY (id_producto_principal) REFERENCES ventas_productos (id_producto) ON DELETE SET NULL ON UPDATE CASCADE");
        } catch (Throwable $e) {
            // Si el hosting no permite agregar la FK, el sistema igual funciona usando la validación del backend.
        }
    }
}


function ventas_asegurar_esquema_precios_producto($pdo) {
    // Nuevo esquema: cada producto tiene precio anticipada y precio en puerta.
    // La columna legacy `precio` queda como espejo de anticipada para compatibilidad.
    if (!ventas_column_exists($pdo, 'ventas_productos', 'precio_anticipada')) {
        $after = ventas_column_exists($pdo, 'ventas_productos', 'precio') ? ' AFTER precio' : '';
        $pdo->exec("ALTER TABLE ventas_productos ADD COLUMN precio_anticipada DECIMAL(12,2) NOT NULL DEFAULT 0.00" . $after);
    }

    if (!ventas_column_exists($pdo, 'ventas_productos', 'precio_puerta')) {
        $after = ventas_column_exists($pdo, 'ventas_productos', 'precio_anticipada') ? ' AFTER precio_anticipada' : '';
        $pdo->exec("ALTER TABLE ventas_productos ADD COLUMN precio_puerta DECIMAL(12,2) NOT NULL DEFAULT 0.00" . $after);
    }

    try {
        if (ventas_column_exists($pdo, 'ventas_productos', 'precio')) {
            $pdo->exec("
                UPDATE ventas_productos
                SET precio_anticipada = precio
                WHERE id_producto > 0
                  AND (precio_anticipada IS NULL OR precio_anticipada = 0)
                  AND precio IS NOT NULL
                  AND precio > 0
            ");

            $pdo->exec("
                UPDATE ventas_productos
                SET precio_puerta = CASE
                    WHEN precio_anticipada IS NOT NULL AND precio_anticipada > 0 THEN precio_anticipada
                    ELSE precio
                END
                WHERE id_producto > 0
                  AND (precio_puerta IS NULL OR precio_puerta = 0)
                  AND ((precio_anticipada IS NOT NULL AND precio_anticipada > 0) OR (precio IS NOT NULL AND precio > 0))
            ");

            $pdo->exec("UPDATE ventas_productos SET precio = precio_anticipada WHERE id_producto > 0 AND precio_anticipada IS NOT NULL");
        }
    } catch (Throwable $e) {
        // La migración de datos no debe bloquear la pantalla si una base vieja tiene datos atípicos.
    }
}

function ventas_asegurar_esquema_ordenes_medios_pago($pdo) {
    if (!ventas_column_exists($pdo, 'ventas_ordenes', 'id_medio_pago')) {
        $pdo->exec("ALTER TABLE ventas_ordenes ADD COLUMN id_medio_pago INT UNSIGNED NOT NULL DEFAULT 2 AFTER total");
    }

    try {
        $pdo->exec("UPDATE ventas_ordenes SET id_medio_pago = 2 WHERE id_medio_pago IS NULL OR id_medio_pago = 0");
    } catch (Throwable $e) {
        // Si la base todavía no tiene datos compatibles, no bloqueamos el módulo.
    }

    if (!ventas_index_exists($pdo, 'ventas_ordenes', 'idx_ventas_ordenes_medio')) {
        try {
            $pdo->exec("ALTER TABLE ventas_ordenes ADD KEY idx_ventas_ordenes_medio (id_medio_pago)");
        } catch (Throwable $e) {
            // El índice no es crítico para operar.
        }
    }

    if (!ventas_constraint_exists($pdo, 'ventas_ordenes', 'fk_ventas_ordenes_medio')) {
        try {
            $pdo->exec("ALTER TABLE ventas_ordenes ADD CONSTRAINT fk_ventas_ordenes_medio FOREIGN KEY (id_medio_pago) REFERENCES medio_pago (id_medio_pago) ON DELETE RESTRICT ON UPDATE CASCADE");
        } catch (Throwable $e) {
            // En algunos hostings la FK puede fallar por motor o datos viejos; el backend igual valida el medio.
        }
    }
}


function ventas_asegurar_esquema_ordenes_retiro($pdo) {
    if (!ventas_column_exists($pdo, 'ventas_ordenes', 'retirado')) {
        $after = ventas_column_exists($pdo, 'ventas_ordenes', 'pdf_url') ? ' AFTER pdf_url' : '';
        $pdo->exec("ALTER TABLE ventas_ordenes ADD COLUMN retirado TINYINT(1) NOT NULL DEFAULT 0" . $after);
    }

    if (!ventas_column_exists($pdo, 'ventas_ordenes', 'retirado_en')) {
        $after = ventas_column_exists($pdo, 'ventas_ordenes', 'retirado') ? ' AFTER retirado' : '';
        $pdo->exec("ALTER TABLE ventas_ordenes ADD COLUMN retirado_en DATETIME NULL DEFAULT NULL" . $after);
    }

    try {
        $pdo->exec("UPDATE ventas_ordenes SET retirado = 0 WHERE retirado IS NULL");
    } catch (Throwable $e) {
        // No bloqueamos el módulo si una base vieja todavía no permite esta actualización.
    }

    if (!ventas_index_exists($pdo, 'ventas_ordenes', 'idx_ventas_ordenes_retiro')) {
        try {
            $pdo->exec("ALTER TABLE ventas_ordenes ADD KEY idx_ventas_ordenes_retiro (retirado, retirado_en)");
        } catch (Throwable $e) {
            // El índice no es crítico para operar.
        }
    }
}


function ventas_asegurar_esquema_items_excel($pdo) {
    // No se crea una tabla nueva para las columnas tipo Excel.
    // Cada columna de cantidad (VEN, GAN, etc.) se guarda como un item de la venta.
    try {
        $col = ventas_column_exists($pdo, 'ventas_orden_items', 'id_producto');
        if ($col && strtoupper((string)($col['Null'] ?? 'NO')) === 'NO') {
            $pdo->exec("ALTER TABLE ventas_orden_items MODIFY id_producto INT UNSIGNED NULL DEFAULT NULL");
        }
    } catch (Throwable $e) {
        // Si por una FK vieja no permite modificar, el sistema igual funciona usando productos existentes.
    }

    if (!ventas_column_exists($pdo, 'ventas_orden_items', 'columna_codigo')) {
        $after = ventas_column_exists($pdo, 'ventas_orden_items', 'producto_nombre') ? ' AFTER producto_nombre' : '';
        $pdo->exec("ALTER TABLE ventas_orden_items ADD COLUMN columna_codigo VARCHAR(30) NULL DEFAULT NULL" . $after);
    }

    if (!ventas_column_exists($pdo, 'ventas_orden_items', 'columna_nombre')) {
        $after = ventas_column_exists($pdo, 'ventas_orden_items', 'columna_codigo') ? ' AFTER columna_codigo' : '';
        $pdo->exec("ALTER TABLE ventas_orden_items ADD COLUMN columna_nombre VARCHAR(120) NULL DEFAULT NULL" . $after);
    }

    if (!ventas_column_exists($pdo, 'ventas_orden_items', 'orden_columna')) {
        $after = ventas_column_exists($pdo, 'ventas_orden_items', 'columna_nombre') ? ' AFTER columna_nombre' : '';
        $pdo->exec("ALTER TABLE ventas_orden_items ADD COLUMN orden_columna INT NOT NULL DEFAULT 1" . $after);
    }

    if (!ventas_column_exists($pdo, 'ventas_orden_items', 'metadata_json')) {
        $after = ventas_column_exists($pdo, 'ventas_orden_items', 'subtotal') ? ' AFTER subtotal' : '';
        $pdo->exec("ALTER TABLE ventas_orden_items ADD COLUMN metadata_json LONGTEXT NULL DEFAULT NULL" . $after);
    }

    if (!ventas_index_exists($pdo, 'ventas_orden_items', 'idx_ventas_items_columna')) {
        try {
            $pdo->exec("ALTER TABLE ventas_orden_items ADD KEY idx_ventas_items_columna (columna_codigo, orden_columna)");
        } catch (Throwable $e) {
            // El índice ayuda pero no es obligatorio.
        }
    }
}


function ventas_normalizar_dni($value) {
    return preg_replace('/\D+/', '', (string)($value ?? '')) ?: '';
}

function ventas_asegurar_esquema_personas($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS ventas_personas (
        id_persona INT UNSIGNED NOT NULL AUTO_INCREMENT,
        dni VARCHAR(20) COLLATE utf8mb4_unicode_ci NOT NULL,
        nombre_apellido VARCHAR(160) COLLATE utf8mb4_unicode_ci NOT NULL,
        id_alumno INT NULL DEFAULT NULL,
        origen ENUM('alumno','bot','manual') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
        observacion VARCHAR(255) COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL,
        creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id_persona),
        UNIQUE KEY uq_ventas_personas_dni (dni),
        KEY idx_ventas_personas_nombre (nombre_apellido),
        KEY idx_ventas_personas_alumno (id_alumno)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Migración de limpieza: el WhatsApp se guarda en bot_contactos y en ventas_ordenes,
    // no en ventas_personas. Si viene de una versión anterior, se elimina la columna duplicada.
    if (ventas_column_exists($pdo, 'ventas_personas', 'wa_id')) {
        try {
            if (ventas_index_exists($pdo, 'ventas_personas', 'idx_ventas_personas_wa')) {
                $pdo->exec("ALTER TABLE ventas_personas DROP INDEX idx_ventas_personas_wa");
            }
        } catch (Throwable $e) {}
        try {
            $pdo->exec("ALTER TABLE ventas_personas DROP COLUMN wa_id");
        } catch (Throwable $e) {}
    }

    if (!ventas_column_exists($pdo, 'ventas_ordenes', 'id_venta_persona')) {
        $after = ventas_column_exists($pdo, 'ventas_ordenes', 'persona_detalle') ? ' AFTER persona_detalle' : '';
        $pdo->exec("ALTER TABLE ventas_ordenes ADD COLUMN id_venta_persona INT UNSIGNED NULL DEFAULT NULL" . $after);
    }

    if (!ventas_column_exists($pdo, 'ventas_ordenes', 'persona_dni')) {
        $after = ventas_column_exists($pdo, 'ventas_ordenes', 'id_venta_persona') ? ' AFTER id_venta_persona' : '';
        $pdo->exec("ALTER TABLE ventas_ordenes ADD COLUMN persona_dni VARCHAR(20) COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL" . $after);
    }

    if (!ventas_index_exists($pdo, 'ventas_ordenes', 'idx_ventas_ordenes_persona_dni')) {
        try {
            $pdo->exec("ALTER TABLE ventas_ordenes ADD KEY idx_ventas_ordenes_persona_dni (persona_dni)");
        } catch (Throwable $e) {}
    }

    if (!ventas_index_exists($pdo, 'ventas_ordenes', 'idx_ventas_ordenes_persona_ref')) {
        try {
            $pdo->exec("ALTER TABLE ventas_ordenes ADD KEY idx_ventas_ordenes_persona_ref (id_venta_persona)");
        } catch (Throwable $e) {}
    }

    if (!ventas_constraint_exists($pdo, 'ventas_ordenes', 'fk_ventas_ordenes_persona')) {
        try {
            $pdo->exec("ALTER TABLE ventas_ordenes ADD CONSTRAINT fk_ventas_ordenes_persona FOREIGN KEY (id_venta_persona) REFERENCES ventas_personas (id_persona) ON DELETE SET NULL ON UPDATE CASCADE");
        } catch (Throwable $e) {
            // La relación ayuda, pero si el hosting o datos viejos no permiten crearla, el módulo igual funciona.
        }
    }
}

function ventas_nombre_alumno_desde_row($alumno) {
    if (!is_array($alumno)) return '';
    $apellido = ventas_text($alumno['apellido'] ?? '', 80, true);
    $nombre = ventas_text($alumno['nombre'] ?? '', 80, true);
    return trim($apellido . ' ' . $nombre);
}

function ventas_buscar_alumno_por_dni($pdo, $dni) {
    $dni = ventas_normalizar_dni($dni);
    if ($dni === '') return null;

    $st = $pdo->prepare('SELECT id_alumno, apellido, nombre, num_documento FROM alumnos WHERE num_documento = :dni LIMIT 1');
    $st->execute([':dni' => $dni]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

function ventas_guardar_persona_venta($pdo, $dni, $nombre, $idAlumno = null, $waId = null, $origen = 'manual') {
    $dni = ventas_normalizar_dni($dni);
    $nombre = ventas_text($nombre, 160, true);
    $idAlumno = $idAlumno !== null && (int)$idAlumno > 0 ? (int)$idAlumno : null;
    // $waId queda solo por compatibilidad de firma. No se guarda en ventas_personas:
    // el vínculo WhatsApp ↔ DNI pertenece a bot_contactos, y la orden conserva ventas_ordenes.wa_id.
    unset($waId);
    $origen = in_array($origen, ['alumno', 'bot', 'manual'], true) ? $origen : 'manual';

    if ($dni === '') {
        throw new InvalidArgumentException('Ingresá el DNI de la persona.');
    }
    if ($nombre === '') {
        throw new InvalidArgumentException('Ingresá el nombre y apellido de la persona.');
    }

    $st = $pdo->prepare("INSERT INTO ventas_personas
        (dni, nombre_apellido, id_alumno, origen, creado_en, actualizado_en)
        VALUES (:dni, :nombre, :id_alumno, :origen, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          nombre_apellido = VALUES(nombre_apellido),
          id_alumno = COALESCE(VALUES(id_alumno), id_alumno),
          origen = VALUES(origen),
          actualizado_en = NOW()");
    $st->execute([
        ':dni' => $dni,
        ':nombre' => $nombre,
        ':id_alumno' => $idAlumno,
        ':origen' => $origen,
    ]);

    $st = $pdo->prepare('SELECT id_persona, dni, nombre_apellido, id_alumno, origen FROM ventas_personas WHERE dni = :dni LIMIT 1');
    $st->execute([':dni' => $dni]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new RuntimeException('No se pudo guardar la persona de la venta.');
    }

    return $row;
}

function ventas_resolver_persona_venta($pdo, $dni, $nombreInformado = '', $waId = null, $origen = 'manual') {
    ventas_asegurar_esquema_personas($pdo);

    $dni = ventas_normalizar_dni($dni);
    $nombreInformado = ventas_text($nombreInformado, 160, true);
    if ($dni === '') {
        throw new InvalidArgumentException('Ingresá el DNI de la persona.');
    }

    $alumno = ventas_buscar_alumno_por_dni($pdo, $dni);
    if ($alumno) {
        $nombreAlumno = ventas_nombre_alumno_desde_row($alumno);
        $nombreFinal = $nombreInformado !== '' ? $nombreInformado : $nombreAlumno;
        $persona = ventas_guardar_persona_venta($pdo, $dni, $nombreFinal, (int)$alumno['id_alumno'], $waId, 'alumno');
        $persona['id_alumno'] = (int)$alumno['id_alumno'];
        $persona['nombre_apellido'] = $nombreFinal;
        return $persona;
    }

    $st = $pdo->prepare('SELECT id_persona, dni, nombre_apellido, id_alumno, origen FROM ventas_personas WHERE dni = :dni LIMIT 1');
    $st->execute([':dni' => $dni]);
    $persona = $st->fetch(PDO::FETCH_ASSOC);

    if ($persona && $nombreInformado === '') {
        return $persona;
    }

    if ($nombreInformado === '') {
        throw new InvalidArgumentException('No encontré ese DNI en alumnos ni en personas de ventas. Ingresá nombre y apellido para registrarlo.');
    }

    return ventas_guardar_persona_venta($pdo, $dni, $nombreInformado, $persona['id_alumno'] ?? null, $waId, $origen);
}

function ventas_tablas_verificadas($pdo) {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }

    $st = $pdo->query("SHOW TABLES LIKE 'ventas_campanias'");
    if (!$st || !$st->fetchColumn()) {
        throw new RuntimeException('Faltan las tablas del módulo Ventas. Ejecutá primero database/migrations/2026_05_20_ventas_generales.sql en la base de Cooperadora.');
    }

    // Preparar tablas/columnas contables SIEMPRE antes de que cualquier acción abra transacciones.
    // Si esto se hace dentro de ventas_sincronizar_orden_contable(), MySQL corta la transacción
    // por los CREATE/ALTER y luego aparece: "There is no active transaction".
    ventas_contable_asegurar_tablas($pdo);

    ventas_asegurar_esquema_productos_independientes($pdo);
    ventas_asegurar_esquema_precios_producto($pdo);
    ventas_asegurar_esquema_ordenes_medios_pago($pdo);
    ventas_asegurar_esquema_ordenes_retiro($pdo);
    ventas_asegurar_esquema_personas($pdo);
    ventas_asegurar_esquema_items_excel($pdo);
}

function ventas_tipo_persona($value) {
    // Flujo unificado: todas las ventas escolares identifican a la persona por DNI.
    // Se conserva el valor interno 'vendedor' por compatibilidad con el enum existente.
    return 'vendedor';
}

function ventas_pregunta_default($tipoPersona) {
    return 'Ingresá el DNI de la persona/alumno que va a realizar la compra o pago.';
}

function ventas_mensaje_inicio_default($tipoPersona) {
    return 'Indicá la cantidad que querés comprar o registrar.';
}

function ventas_normalizar_stock($stockRaw) {
    if ($stockRaw === '' || $stockRaw === null) return null;
    return max(0, (int)$stockRaw);
}
