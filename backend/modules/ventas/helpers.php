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
