<?php
declare(strict_types=1);

// backend/modules/categorias/editar_categoria.php
require_once __DIR__ . '/../../config/db.php';

try {
    if (!isset($pdo) || !($pdo instanceof PDO)) {
        json_out(['exito' => false, 'mensaje' => 'Conexión PDO no disponible.'], 500);
    }

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    if ($method !== 'POST') {
        json_out(['exito' => false, 'mensaje' => 'Método no permitido (usar POST).'], 405);
    }

    /* =========================
       ID compatible
    ========================= */
    $id = 0;
    if (isset($_POST['id'])) $id = (int)$_POST['id'];
    elseif (isset($_POST['id_cat_monto'])) $id = (int)$_POST['id_cat_monto'];
    elseif (isset($_POST['id_categoria'])) $id = (int)$_POST['id_categoria'];

    if ($id <= 0) {
        json_out(['exito' => false, 'mensaje' => 'Falta id de categoría (id).'], 400);
    }

    /* =========================
       Helpers locales
    ========================= */
    $toIntOrNull = function($v): ?int {
        if ($v === null) return null;
        $s = trim((string)$v);
        if ($s === '') return null;
        if (!is_numeric($s)) return null;
        $n = (int)$s;
        return $n >= 0 ? $n : null;
    };

    $toDecOrNull = function($v): ?float {
        if ($v === null) return null;
        $s = trim((string)$v);
        if ($s === '') return null;

        // admite "1.234,56" y "1234.56"
        $s = preg_replace('/[^\d.,-]/', '', $s);
        if (strpos($s, ',') !== false && strpos($s, '.') !== false) {
            $s = str_replace('.', '', $s);
            $s = str_replace(',', '.', $s);
        } else {
            $s = str_replace(',', '.', $s);
        }
        if ($s === '' || !is_numeric($s)) return null;

        $n = (float)$s;
        return $n >= 0 ? $n : null;
    };

    /* =========================
       Inputs (base)
    ========================= */
    // En categoria_monto tus montos son INT UNSIGNED
    $montoMensual = null;
    if (isset($_POST['monto'])) $montoMensual = $toIntOrNull($_POST['monto']);
    elseif (isset($_POST['precio'])) $montoMensual = $toIntOrNull($_POST['precio']); // compat

    $montoAnual = null;
    if (isset($_POST['monto_anual'])) $montoAnual = $toIntOrNull($_POST['monto_anual']);

    /* =========================
       Inputs (hermanos)
    ========================= */
    $hermanosRaw = isset($_POST['hermanos']) ? (string)$_POST['hermanos'] : null;
    $hermanos = null;

    if ($hermanosRaw !== null) {
        $decoded = json_decode($hermanosRaw, true);
        if (!is_array($decoded)) {
            json_out(['exito' => false, 'mensaje' => 'Campo hermanos inválido (debe ser JSON array).'], 400);
        }
        $hermanos = $decoded; // array de {cantidad_hermanos, monto_mensual, monto_anual}
    }

    /* =========================
       Validar que exista + snapshot base ANTES
    ========================= */
    $stBase = $pdo->prepare("
        SELECT id_cat_monto, monto_mensual, monto_anual
        FROM cooperadora.categoria_monto
        WHERE id_cat_monto = :id
        LIMIT 1
    ");
    $stBase->execute([':id' => $id]);
    $baseRow = $stBase->fetch(PDO::FETCH_ASSOC);

    if (!$baseRow) {
        json_out(['exito' => false, 'mensaje' => 'Categoría no encontrada.'], 404);
    }

    $prevBaseMM = ($baseRow['monto_mensual'] !== null) ? (int)$baseRow['monto_mensual'] : null;
    $prevBaseMA = ($baseRow['monto_anual']   !== null) ? (int)$baseRow['monto_anual']   : null;

    // Flags de cambio (solo si vino el campo)
    $changedBaseMens = ($montoMensual !== null) && ($prevBaseMM === null || (int)$montoMensual !== (int)$prevBaseMM);
    $changedBaseAnu  = ($montoAnual   !== null) && ($prevBaseMA === null || (int)$montoAnual   !== (int)$prevBaseMA);

    /* =========================
       Prepared historial base (precios_historicos)
       Si la tabla no existe en algún entorno, NO rompemos.
    ========================= */
    $stPrecioHist = null;
    try {
        $stPrecioHist = $pdo->prepare("
            INSERT INTO cooperadora.precios_historicos
                (id_cat_monto, tipo, precio_anterior, precio_nuevo, fecha_cambio)
            VALUES
                (:id, :tipo, :pa, :pn, NOW())
        ");
    } catch (Throwable $ignore) {
        $stPrecioHist = null;
    }

    $pdo->beginTransaction();

    /* =========================
       1) Actualizar categoria_monto (si hay campos)
    ========================= */
    $set = [];
    $params = [':id' => $id];

    if ($montoMensual !== null) {
        $set[] = "monto_mensual = :mm";
        $params[':mm'] = $montoMensual;
    }
    if ($montoAnual !== null) {
        $set[] = "monto_anual = :ma";
        $params[':ma'] = $montoAnual;
    }

    if (!empty($set)) {
        $sql = "UPDATE cooperadora.categoria_monto SET " . implode(', ', $set) . " WHERE id_cat_monto = :id";
        $stUp = $pdo->prepare($sql);
        $stUp->execute($params);
    }

    /* =========================
       1.1) Historial BASE: precios_historicos
       (MENSUAL/ANUAL) SOLO si cambió realmente
    ========================= */
    if ($stPrecioHist) {
        if ($changedBaseMens) {
            $stPrecioHist->execute([
                ':id'   => $id,
                ':tipo' => 'MENSUAL',
                ':pa'   => $prevBaseMM,
                ':pn'   => (int)$montoMensual,
            ]);
        }
        if ($changedBaseAnu) {
            $stPrecioHist->execute([
                ':id'   => $id,
                ':tipo' => 'ANUAL',
                ':pa'   => $prevBaseMA,
                ':pn'   => (int)$montoAnual,
            ]);
        }
    }

    /* =========================
       2) Actualizar categoria_hermanos (si vino hermanos)
       Historial: categoria_hermanos_historial (ya lo tenías)
    ========================= */
    if ($hermanos !== null) {

        // Desactivar todo (soft) para luego reactivar lo que venga
        $stOff = $pdo->prepare("UPDATE cooperadora.categoria_hermanos SET activo = 0 WHERE id_cat_monto = :id");
        $stOff->execute([':id' => $id]);

        // Prepared del historial hermanos (si existe la tabla)
        $stHist = null;
        try {
            $stHist = $pdo->prepare("
                INSERT INTO cooperadora.categoria_hermanos_historial
                    (id_cat_hermanos, tipo, precio_anterior, precio_nuevo, fecha_cambio)
                VALUES
                    (:idh, :tipo, :pa, :pn, NOW())
            ");
        } catch (Throwable $ignore) {
            $stHist = null;
        }

        // Preparados reusables (evitás preparar en cada loop)
        $stFind = $pdo->prepare("
            SELECT id_cat_hermanos
            FROM cooperadora.categoria_hermanos
            WHERE id_cat_monto = :id AND cantidad_hermanos = :cant
            LIMIT 1
        ");

        $stPrev = $pdo->prepare("
            SELECT monto_mensual, monto_anual
            FROM cooperadora.categoria_hermanos
            WHERE id_cat_hermanos = :idh
            LIMIT 1
        ");

        $stUpdH = $pdo->prepare("
            UPDATE cooperadora.categoria_hermanos
            SET monto_mensual = :mm,
                monto_anual   = :ma,
                activo        = 1
            WHERE id_cat_hermanos = :idh
        ");

        $stInsH = $pdo->prepare("
            INSERT INTO cooperadora.categoria_hermanos
              (id_cat_monto, cantidad_hermanos, monto_mensual, monto_anual, activo)
            VALUES
              (:id, :cant, :mm, :ma, 1)
        ");

        foreach ($hermanos as $h) {
            $cant = isset($h['cantidad_hermanos']) ? (int)$h['cantidad_hermanos'] : 0;
            if ($cant < 2) continue;

            // Los montos de hermanos pueden venir como string => dec
            $mm = array_key_exists('monto_mensual', $h) ? $toDecOrNull($h['monto_mensual']) : null;
            $ma = array_key_exists('monto_anual',   $h) ? $toDecOrNull($h['monto_anual'])   : null;

            if ($mm === null && $ma === null) continue;

            // Buscar si existe fila
            $stFind->execute([':id' => $id, ':cant' => $cant]);
            $idCatH = $stFind->fetchColumn();

            if ($idCatH) {
                $idCatH = (int)$idCatH;

                // Leer previos ANTES
                $prevMM = null; $prevMA = null;
                $stPrev->execute([':idh' => $idCatH]);
                $prev = $stPrev->fetch(PDO::FETCH_ASSOC);
                if (is_array($prev)) {
                    $prevMM = ($prev['monto_mensual'] !== null) ? (float)$prev['monto_mensual'] : null;
                    $prevMA = ($prev['monto_anual']   !== null) ? (float)$prev['monto_anual']   : null;
                }

                // Update (guardamos 0 si vino null)
                $stUpdH->execute([
                    ':mm'  => $mm ?? 0,
                    ':ma'  => $ma ?? 0,
                    ':idh' => $idCatH,
                ]);

                // Historial SOLO si cambió realmente
                if ($stHist) {
                    if ($mm !== null) {
                        $newMM = (float)$mm;
                        if ($prevMM === null || $newMM != (float)$prevMM) {
                            $stHist->execute([
                                ':idh'  => $idCatH,
                                ':tipo' => 'MENSUAL',
                                ':pa'   => $prevMM,
                                ':pn'   => $newMM,
                            ]);
                        }
                    }
                    if ($ma !== null) {
                        $newMA = (float)$ma;
                        if ($prevMA === null || $newMA != (float)$prevMA) {
                            $stHist->execute([
                                ':idh'  => $idCatH,
                                ':tipo' => 'ANUAL',
                                ':pa'   => $prevMA,
                                ':pn'   => $newMA,
                            ]);
                        }
                    }
                }

            } else {
                // Insert nuevo
                $stInsH->execute([
                    ':id'   => $id,
                    ':cant' => $cant,
                    ':mm'   => $mm ?? 0,
                    ':ma'   => $ma ?? 0,
                ]);

                $newId = (int)$pdo->lastInsertId();

                // Historial inicial
                if ($stHist) {
                    if ($mm !== null) {
                        $stHist->execute([
                            ':idh'  => $newId,
                            ':tipo' => 'MENSUAL',
                            ':pa'   => null,
                            ':pn'   => (float)$mm,
                        ]);
                    }
                    if ($ma !== null) {
                        $stHist->execute([
                            ':idh'  => $newId,
                            ':tipo' => 'ANUAL',
                            ':pa'   => null,
                            ':pn'   => (float)$ma,
                        ]);
                    }
                }
            }
        }
    }

    $pdo->commit();
    json_out(['exito' => true, 'mensaje' => 'Categoría actualizada.']);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_out([
        'exito' => false,
        'mensaje' => 'Error al actualizar categoría',
        'detalle' => $e->getMessage(),
    ], 500);
}