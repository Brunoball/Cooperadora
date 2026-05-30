<?php
// backend/modules/ventas/importar_planilla.php
// Importa planillas Excel con formato: ORDEN, APELLIDO Y NOMBRES, CURSO, DIVISIÓN, VEN, GAN, COBRADO, OBSERVACIONES.

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function ventas_importar_fecha_sql($value): string {
    $v = trim((string)($value ?? ''));
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) {
        $parts = explode('-', $v);
        if (checkdate((int)$parts[1], (int)$parts[2], (int)$parts[0])) {
            return $v . ' 00:00:00';
        }
    }
    return date('Y-m-d H:i:s');
}

function ventas_xlsx_col_index(string $cellRef): int {
    if (!preg_match('/^([A-Z]+)/i', $cellRef, $m)) return 0;
    $letters = strtoupper($m[1]);
    $n = 0;
    for ($i = 0; $i < strlen($letters); $i++) {
        $n = $n * 26 + (ord($letters[$i]) - 64);
    }
    return $n - 1;
}

function ventas_xlsx_row_number(string $cellRef): int {
    if (!preg_match('/(\d+)/', $cellRef, $m)) return 0;
    return (int)$m[1];
}

function ventas_xlsx_shared_strings(ZipArchive $zip): array {
    $raw = $zip->getFromName('xl/sharedStrings.xml');
    if ($raw === false) return [];
    $xml = simplexml_load_string($raw);
    if (!$xml) return [];

    $items = [];
    foreach ($xml->si as $si) {
        $txt = '';
        if (isset($si->t)) {
            $txt .= (string)$si->t;
        }
        if (isset($si->r)) {
            foreach ($si->r as $run) {
                $txt .= (string)$run->t;
            }
        }
        $items[] = $txt;
    }
    return $items;
}

function ventas_xlsx_resolve_sheet_path(ZipArchive $zip, string $preferredName = 'ALUMNOS-BASE'): string {
    $workbookRaw = $zip->getFromName('xl/workbook.xml');
    $relsRaw = $zip->getFromName('xl/_rels/workbook.xml.rels');
    if ($workbookRaw === false || $relsRaw === false) return 'xl/worksheets/sheet1.xml';

    $workbook = simplexml_load_string($workbookRaw);
    $rels = simplexml_load_string($relsRaw);
    if (!$workbook || !$rels) return 'xl/worksheets/sheet1.xml';

    $targetById = [];
    foreach ($rels->Relationship as $rel) {
        $id = (string)$rel['Id'];
        $target = (string)$rel['Target'];
        if ($id !== '' && $target !== '') {
            $targetById[$id] = (strpos($target, 'xl/') === 0) ? $target : 'xl/' . ltrim($target, '/');
        }
    }

    $namespaces = $workbook->getNamespaces(true);
    $rNs = $namespaces['r'] ?? 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    $firstPath = '';

    foreach ($workbook->sheets->sheet as $sheet) {
        $name = (string)$sheet['name'];
        $attrs = $sheet->attributes($rNs);
        $rid = (string)($attrs['id'] ?? '');
        $path = $targetById[$rid] ?? '';
        if ($firstPath === '' && $path !== '') $firstPath = $path;
        if (mb_strtoupper(trim($name), 'UTF-8') === mb_strtoupper(trim($preferredName), 'UTF-8') && $path !== '') {
            return $path;
        }
    }

    return $firstPath ?: 'xl/worksheets/sheet1.xml';
}

function ventas_xlsx_cell_value(SimpleXMLElement $cell, array $shared) {
    $type = (string)($cell['t'] ?? '');
    $raw = isset($cell->v) ? (string)$cell->v : '';

    if ($type === 's') {
        $idx = is_numeric($raw) ? (int)$raw : -1;
        return $shared[$idx] ?? '';
    }

    if ($type === 'inlineStr') {
        if (isset($cell->is->t)) return (string)$cell->is->t;
        $txt = '';
        if (isset($cell->is->r)) {
            foreach ($cell->is->r as $run) $txt .= (string)$run->t;
        }
        return $txt;
    }

    if ($raw === '') return '';
    if (is_numeric($raw)) {
        $num = (float)$raw;
        return floor($num) == $num ? (int)$num : $num;
    }
    return $raw;
}

function ventas_xlsx_leer_filas(string $tmpPath): array {
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('El servidor no tiene habilitada la extensión ZipArchive de PHP, necesaria para leer archivos .xlsx.');
    }

    $zip = new ZipArchive();
    if ($zip->open($tmpPath) !== true) {
        throw new RuntimeException('No se pudo abrir el archivo Excel. Verificá que sea .xlsx válido.');
    }

    $shared = ventas_xlsx_shared_strings($zip);
    $sheetPath = ventas_xlsx_resolve_sheet_path($zip, 'ALUMNOS-BASE');
    $sheetRaw = $zip->getFromName($sheetPath);
    if ($sheetRaw === false) {
        $sheetRaw = $zip->getFromName('xl/worksheets/sheet1.xml');
    }
    if ($sheetRaw === false) {
        $zip->close();
        throw new RuntimeException('No se encontró la hoja de cálculo dentro del Excel.');
    }

    $xml = simplexml_load_string($sheetRaw);
    $zip->close();
    if (!$xml) throw new RuntimeException('No se pudo leer la hoja del Excel.');

    $rows = [];
    foreach ($xml->sheetData->row as $row) {
        foreach ($row->c as $cell) {
            $ref = (string)$cell['r'];
            $rowNumber = ventas_xlsx_row_number($ref);
            $colIndex = ventas_xlsx_col_index($ref);
            if ($rowNumber <= 0) continue;
            if (!isset($rows[$rowNumber])) $rows[$rowNumber] = [];
            $rows[$rowNumber][$colIndex] = ventas_xlsx_cell_value($cell, $shared);
        }
    }

    ksort($rows);
    return $rows;
}

function ventas_importar_numero($value): float {
    if ($value === null || $value === '') return 0.0;
    if (is_numeric($value)) return (float)$value;
    $txt = str_replace(['$', ' '], '', (string)$value);
    if (strpos($txt, ',') !== false) {
        $txt = str_replace('.', '', $txt);
        $txt = str_replace(',', '.', $txt);
    }
    return is_numeric($txt) ? (float)$txt : 0.0;
}

function ventas_importar_texto($value, int $max = 255, bool $upper = false): string {
    return ventas_text((string)($value ?? ''), $max, $upper);
}

function ventas_importar_medio_id(PDO $pdo, ?string $obs): int {
    $obsNorm = mb_strtolower((string)$obs, 'UTF-8');
    $preferido = (strpos($obsNorm, 'tranf') !== false || strpos($obsNorm, 'transf') !== false || strpos($obsNorm, 'transfer') !== false)
        ? 'TRANSFERENCIA'
        : 'EFECTIVO';

    $st = $pdo->prepare('SELECT id_medio_pago FROM medio_pago WHERE UPPER(medio_pago) = :medio LIMIT 1');
    $st->execute([':medio' => $preferido]);
    $id = (int)$st->fetchColumn();
    if ($id > 0) return $id;

    $fallback = $pdo->query('SELECT id_medio_pago FROM medio_pago ORDER BY id_medio_pago ASC LIMIT 1')->fetchColumn();
    return (int)($fallback ?: 1);
}

function ventas_importar_producto(PDO $pdo, string $nombre, string $descripcion, float $precio): int {
    $st = $pdo->prepare('SELECT id_producto FROM ventas_productos WHERE nombre = :nombre LIMIT 1');
    $st->execute([':nombre' => $nombre]);
    $id = (int)$st->fetchColumn();
    if ($id > 0) {
        $up = $pdo->prepare('UPDATE ventas_productos SET descripcion = :descripcion, precio = :precio, activo = 1 WHERE id_producto = :id LIMIT 1');
        $up->execute([':descripcion' => $descripcion, ':precio' => $precio, ':id' => $id]);
        return $id;
    }

    $ins = $pdo->prepare('INSERT INTO ventas_productos (nombre, descripcion, precio, stock, activo) VALUES (:nombre, :descripcion, :precio, NULL, 1)');
    $ins->execute([':nombre' => $nombre, ':descripcion' => $descripcion, ':precio' => $precio]);
    return (int)$pdo->lastInsertId();
}

function ventas_importar_campania(PDO $pdo, string $nombre, int $idProductoPrincipal, int $anio): int {
    $st = $pdo->prepare('SELECT id_campania FROM ventas_campanias WHERE nombre = :nombre LIMIT 1');
    $st->execute([':nombre' => $nombre]);
    $id = (int)$st->fetchColumn();

    $pregunta = 'Ingresá el DNI del alumno, docente o responsable que va a realizar el pago.';
    $inicio = 'Indicá la cantidad de productos vendidos.';
    $aprobado = 'Pago aprobado. La venta quedó registrada para el responsable informado.';

    if ($id > 0) {
        $up = $pdo->prepare(" 
            UPDATE ventas_campanias
            SET id_producto_principal = :producto,
                tipo_persona = 'vendedor',
                pregunta_persona = :pregunta,
                mensaje_inicio = :inicio,
                mensaje_aprobado = :aprobado
            WHERE id_campania = :id
            LIMIT 1
        ");
        $up->execute([':producto' => $idProductoPrincipal, ':pregunta' => $pregunta, ':inicio' => $inicio, ':aprobado' => $aprobado, ':id' => $id]);
        return $id;
    }

    $ins = $pdo->prepare(" 
        INSERT INTO ventas_campanias
        (nombre, activo, visible_menu, id_producto_principal, fecha_inicio, fecha_fin, tipo_persona, pregunta_persona, mensaje_inicio, mensaje_aprobado)
        VALUES
        (:nombre, 0, 0, :producto, :fecha_inicio, :fecha_fin, 'vendedor', :pregunta, :inicio, :aprobado)
    ");
    $ins->execute([
        ':nombre' => $nombre,
        ':producto' => $idProductoPrincipal,
        ':fecha_inicio' => sprintf('%04d-01-01', $anio),
        ':fecha_fin' => sprintf('%04d-12-31', $anio),
        ':pregunta' => $pregunta,
        ':inicio' => $inicio,
        ':aprobado' => $aprobado,
    ]);
    return (int)$pdo->lastInsertId();
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        ventas_json(['exito' => false, 'mensaje' => 'Método no permitido.'], 405);
    }

    $pdo = ventas_pdo();
    ventas_tablas_verificadas($pdo);

    if (empty($_FILES['archivo']) || !is_uploaded_file($_FILES['archivo']['tmp_name'])) {
        throw new InvalidArgumentException('Seleccioná un archivo Excel .xlsx para importar.');
    }

    $file = $_FILES['archivo'];
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('No se pudo subir el archivo Excel.');
    }

    $nombreOriginal = (string)($file['name'] ?? 'planilla.xlsx');
    if (!preg_match('/\.xlsx$/i', $nombreOriginal)) {
        throw new InvalidArgumentException('El archivo debe ser .xlsx.');
    }

    $rows = ventas_xlsx_leer_filas((string)$file['tmp_name']);
    $titulo = ventas_importar_texto($rows[2][2] ?? 'VENTA IMPORTADA', 120, true);
    $anio = (int)ventas_importar_numero($rows[2][7] ?? date('Y'));
    if ($anio < 2000 || $anio > 2100) $anio = (int)date('Y');

    $precioVen = ventas_importar_numero($rows[3][4] ?? 0);
    $precioGan = ventas_importar_numero($rows[3][5] ?? 0);
    if ($precioVen <= 0) $precioVen = 5000;
    if ($precioGan <= 0) $precioGan = 2000;

    $nombreCampania = ventas_importar_texto($_POST['nombre_campania'] ?? ($titulo . ' ' . $anio), 150, true);
    $fechaVenta = ventas_importar_fecha_sql($_POST['fecha_venta'] ?? null);

    $pdo->beginTransaction();
    try {
        $idProductoVen = ventas_importar_producto($pdo, $titulo, 'Producto principal importado desde planilla Excel de ventas escolares.', $precioVen);
        $idProductoGan = ventas_importar_producto($pdo, 'GANANCIA / APORTE - ' . $titulo, 'Concepto GAN de la planilla importada; se carga como segundo producto/concepto de la misma venta.', $precioGan);
        $idCampania = ventas_importar_campania($pdo, $nombreCampania, $idProductoVen, $anio);

        $procesadas = 0;
        $cantidadVen = 0;
        $cantidadGan = 0;
        $total = 0.0;
        $omitidas = 0;

        $stOrden = $pdo->prepare(" 
            INSERT INTO ventas_ordenes
            (codigo_orden, id_campania, comprador_telefono, persona_tipo, persona_nombre, persona_detalle, estado,
             total, id_medio_pago, mp_status, origen, observacion, metadata_json, creado_en, aprobado_en)
            VALUES
            (:codigo, :campania, NULL, 'vendedor', :persona, :detalle, 'aprobada',
             :total, :medio, 'importado_excel', 'importado', :observacion, :metadata, :creado_en, :aprobado_en)
            ON DUPLICATE KEY UPDATE
                id_orden = LAST_INSERT_ID(id_orden),
                id_campania = VALUES(id_campania),
                persona_tipo = VALUES(persona_tipo),
                persona_nombre = VALUES(persona_nombre),
                persona_detalle = VALUES(persona_detalle),
                estado = VALUES(estado),
                total = VALUES(total),
                id_medio_pago = VALUES(id_medio_pago),
                mp_status = VALUES(mp_status),
                origen = VALUES(origen),
                observacion = VALUES(observacion),
                metadata_json = VALUES(metadata_json),
                creado_en = VALUES(creado_en),
                aprobado_en = VALUES(aprobado_en),
                cancelado_en = NULL,
                actualizado_en = NOW()
        ");

        $stDeleteItems = $pdo->prepare('DELETE FROM ventas_orden_items WHERE id_orden = :id_orden');
        $stItem = $pdo->prepare(" 
            INSERT INTO ventas_orden_items
            (id_orden, id_producto, producto_nombre, cantidad, precio_unitario, subtotal)
            VALUES
            (:id_orden, :id_producto, :producto_nombre, :cantidad, :precio, :subtotal)
        ");

        foreach ($rows as $rowNumber => $row) {
            if ($rowNumber < 6) continue;

            $ordenPlanilla = (int)ventas_importar_numero($row[0] ?? 0);
            $persona = ventas_importar_texto($row[1] ?? '', 160, true);
            if ($ordenPlanilla <= 0 || $persona === '') continue;

            $ven = (int)ventas_importar_numero($row[4] ?? 0);
            $gan = (int)ventas_importar_numero($row[5] ?? 0);
            if ($ven <= 0 && $gan <= 0) {
                $omitidas++;
                continue;
            }

            $curso = ventas_importar_texto($row[2] ?? '', 20, true);
            $division = ventas_importar_texto($row[3] ?? '', 20, true);
            $detalle = trim('Curso ' . trim($curso . ' ' . $division));
            $obs = ventas_importar_texto($row[7] ?? '', 500, false);
            $importePlanilla = ventas_importar_numero($row[6] ?? 0);
            $subtotalVen = round($ven * $precioVen, 2);
            $subtotalGan = round($gan * $precioGan, 2);
            $totalOrden = round($subtotalVen + $subtotalGan, 2);
            $medio = ventas_importar_medio_id($pdo, $obs);
            $codigo = 'IMP-PD-' . $anio . '-' . str_pad((string)$ordenPlanilla, 4, '0', STR_PAD_LEFT);

            $observacionPartes = ['Importado desde Excel: ' . $nombreOriginal];
            if ($obs !== '') $observacionPartes[] = 'Obs. planilla: ' . $obs;
            if ($importePlanilla > 0 && abs($importePlanilla - $totalOrden) > 0.01) {
                $observacionPartes[] = 'Importe planilla: $' . number_format($importePlanilla, 2, '.', '') . ' / calculado: $' . number_format($totalOrden, 2, '.', '');
            }

            $metadata = json_encode([
                'origen' => 'excel_ventas_escolares',
                'archivo' => $nombreOriginal,
                'fila_excel' => $rowNumber,
                'orden_planilla' => $ordenPlanilla,
                'ven' => $ven,
                'gan' => $gan,
                'precio_ven' => $precioVen,
                'precio_gan' => $precioGan,
                'importe_planilla' => $importePlanilla,
                'observacion_planilla' => $obs,
            ], JSON_UNESCAPED_UNICODE);

            $stOrden->execute([
                ':codigo' => $codigo,
                ':campania' => $idCampania,
                ':persona' => $persona,
                ':detalle' => $detalle !== 'Curso' ? $detalle : null,
                ':total' => $totalOrden,
                ':medio' => $medio,
                ':observacion' => implode(' | ', $observacionPartes),
                ':metadata' => $metadata,
                ':creado_en' => $fechaVenta,
                ':aprobado_en' => $fechaVenta,
            ]);

            $idOrden = (int)$pdo->lastInsertId();
            if ($idOrden <= 0) {
                $stFind = $pdo->prepare('SELECT id_orden FROM ventas_ordenes WHERE codigo_orden = :codigo LIMIT 1');
                $stFind->execute([':codigo' => $codigo]);
                $idOrden = (int)$stFind->fetchColumn();
            }
            if ($idOrden <= 0) throw new RuntimeException('No se pudo identificar la venta importada ' . $codigo);

            $stDeleteItems->execute([':id_orden' => $idOrden]);

            if ($ven > 0) {
                $stItem->execute([
                    ':id_orden' => $idOrden,
                    ':id_producto' => $idProductoVen,
                    ':producto_nombre' => $titulo,
                    ':cantidad' => $ven,
                    ':precio' => $precioVen,
                    ':subtotal' => $subtotalVen,
                ]);
            }
            if ($gan > 0) {
                $stItem->execute([
                    ':id_orden' => $idOrden,
                    ':id_producto' => $idProductoGan,
                    ':producto_nombre' => 'GANANCIA / APORTE - ' . $titulo,
                    ':cantidad' => $gan,
                    ':precio' => $precioGan,
                    ':subtotal' => $subtotalGan,
                ]);
            }

            $procesadas++;
            $cantidadVen += $ven;
            $cantidadGan += $gan;
            $total += $totalOrden;
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    ventas_json([
        'exito' => true,
        'mensaje' => 'Planilla importada correctamente.',
        'resumen' => [
            'campania' => $nombreCampania,
            'procesadas' => $procesadas,
            'omitidas_sin_cantidad' => $omitidas,
            'cantidad_ven' => $cantidadVen,
            'cantidad_gan' => $cantidadGan,
            'total' => round($total, 2),
        ],
    ]);
} catch (Throwable $e) {
    ventas_json(['exito' => false, 'mensaje' => $e->getMessage()], 200);
}
