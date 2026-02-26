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

    // ✅ id compatible con distintos frontends
    $id = 0;
    if (isset($_POST['id'])) $id = (int)$_POST['id'];
    elseif (isset($_POST['id_cat_monto'])) $id = (int)$_POST['id_cat_monto'];
    elseif (isset($_POST['id_categoria'])) $id = (int)$_POST['id_categoria'];

    if ($id <= 0) {
        json_out(['exito' => false, 'mensaje' => 'Falta id de categoría (id).'], 400);
    }

    // Helpers locales (NO declarar json_out)
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

    // ✅ En categoria_monto tus montos son INT UNSIGNED
    $montoMensual = null;
    if (isset($_POST['monto'])) $montoMensual = $toIntOrNull($_POST['monto']);
    elseif (isset($_POST['precio'])) $montoMensual = $toIntOrNull($_POST['precio']); // compat

    $montoAnual = null;
    if (isset($_POST['monto_anual'])) $montoAnual = $toIntOrNull($_POST['monto_anual']);

    $hermanosRaw = isset($_POST['hermanos']) ? (string)$_POST['hermanos'] : null;
    $hermanos = null;

    if ($hermanosRaw !== null) {
        $decoded = json_decode($hermanosRaw, true);
        if (!is_array($decoded)) {
            json_out(['exito' => false, 'mensaje' => 'Campo hermanos inválido (debe ser JSON array).'], 400);
        }
        $hermanos = $decoded; // array de {cantidad_hermanos, monto_mensual, monto_anual}
    }

    // ✅ Validar que exista la categoría
    $stChk = $pdo->prepare("SELECT id_cat_monto FROM cooperadora.categoria_monto WHERE id_cat_monto = :id LIMIT 1");
    $stChk->execute([':id' => $id]);
    if (!$stChk->fetchColumn()) {
        json_out(['exito' => false, 'mensaje' => 'Categoría no encontrada.'], 404);
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
       2) Actualizar categoria_hermanos (si vino hermanos)
       ========================= */
    if ($hermanos !== null) {

        // Desactivar todo
        $stOff = $pdo->prepare("UPDATE cooperadora.categoria_hermanos SET activo = 0 WHERE id_cat_monto = :id");
        $stOff->execute([':id' => $id]);

        // Prepared del historial (nueva estructura)
        $stHist = null;
        try {
            $stHist = $pdo->prepare("
                INSERT INTO cooperadora.categoria_hermanos_historial
                    (id_cat_hermanos, tipo, precio_anterior, precio_nuevo, fecha_cambio)
                VALUES
                    (:idh, :tipo, :pa, :pn, NOW())
            ");
        } catch (Throwable $ignore) {
            $stHist = null; // si no existe tabla, no rompemos
        }

        foreach ($hermanos as $h) {
            $cant = isset($h['cantidad_hermanos']) ? (int)$h['cantidad_hermanos'] : 0;
            if ($cant < 2) continue;

            $mm = array_key_exists('monto_mensual', $h) ? $toDecOrNull($h['monto_mensual']) : null;
            $ma = array_key_exists('monto_anual', $h) ? $toDecOrNull($h['monto_anual']) : null;

            if ($mm === null && $ma === null) continue;

            // ¿Existe fila para esa cantidad?
            $stFind = $pdo->prepare("
                SELECT id_cat_hermanos
                FROM cooperadora.categoria_hermanos
                WHERE id_cat_monto = :id AND cantidad_hermanos = :cant
                LIMIT 1
            ");
            $stFind->execute([':id' => $id, ':cant' => $cant]);
            $idCatH = $stFind->fetchColumn();

            if ($idCatH) {
                $idCatH = (int)$idCatH;

                // 1) Leer valores previos ANTES del update (para precio_anterior)
                $prevMM = null; $prevMA = null;
                $stPrev = $pdo->prepare("
                    SELECT monto_mensual, monto_anual
                    FROM cooperadora.categoria_hermanos
                    WHERE id_cat_hermanos = :idh
                    LIMIT 1
                ");
                $stPrev->execute([':idh' => $idCatH]);
                $prev = $stPrev->fetch(PDO::FETCH_ASSOC);
                if (is_array($prev)) {
                    $prevMM = ($prev['monto_mensual'] !== null) ? (float)$prev['monto_mensual'] : null;
                    $prevMA = ($prev['monto_anual']   !== null) ? (float)$prev['monto_anual']   : null;
                }

                // 2) Update
                $stUpdH = $pdo->prepare("
                    UPDATE cooperadora.categoria_hermanos
                    SET monto_mensual = :mm,
                        monto_anual   = :ma,
                        activo        = 1
                    WHERE id_cat_hermanos = :idh
                ");
                $stUpdH->execute([
                    ':mm'  => $mm ?? 0,
                    ':ma'  => $ma ?? 0,
                    ':idh' => $idCatH,
                ]);

                // 3) Historial: insertar SOLO si cambió
                if ($stHist) {
                    // mensual
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
                    // anual
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
                $stInsH = $pdo->prepare("
                    INSERT INTO cooperadora.categoria_hermanos
                      (id_cat_monto, cantidad_hermanos, monto_mensual, monto_anual, activo)
                    VALUES
                      (:id, :cant, :mm, :ma, 1)
                ");
                $stInsH->execute([
                    ':id'   => $id,
                    ':cant' => $cant,
                    ':mm'   => $mm ?? 0,
                    ':ma'   => $ma ?? 0,
                ]);

                $newId = (int)$pdo->lastInsertId();

                // Historial inicial (precio_anterior NULL)
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