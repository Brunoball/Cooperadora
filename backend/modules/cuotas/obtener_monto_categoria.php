<?php
declare(strict_types=1);

// backend/modules/cuotas/obtener_monto_categoria.php
// ✅ Histórico por AÑO + PERÍODO (mes) usando categoria_hermanos_historial
// ✅ Devuelve montos_por_periodo (1..12) para que el frontend calcule totales correctos
// ✅ Si NO hay regla exacta en categoria_hermanos para N hermanos -> warning y usa base categoria_monto
// ✅ FIX ANUAL: para el ANUAL se toma SIEMPRE el ÚLTIMO monto del AÑO (precio al 31/12 del año)

require_once __DIR__ . '/../../config/db.php';

function table_exists(PDO $pdo, string $table): bool {
  $st = $pdo->prepare("
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = ?
    LIMIT 1
  ");
  $st->execute([$table]);
  return (bool)$st->fetchColumn();
}

function column_exists(PDO $pdo, string $table, string $col): bool {
  $st = $pdo->prepare("
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ?
      AND column_name = ?
    LIMIT 1
  ");
  $st->execute([$table, $col]);
  return (bool)$st->fetchColumn();
}

/**
 * Carga historial de un id_cat_hermanos para un tipo (MENSUAL/ANUAL)
 * Devuelve array ordenado asc por fecha_cambio:
 * [
 *   ['fecha_cambio'=>DateTime,'precio_anterior'=>float,'precio_nuevo'=>float],
 *   ...
 * ]
 */
function cargar_historial(PDO $pdo, int $id_cat_hermanos, string $tipo): array {
  if (!table_exists($pdo, 'categoria_hermanos_historial')) return [];

  $st = $pdo->prepare("
    SELECT fecha_cambio, precio_anterior, precio_nuevo
    FROM categoria_hermanos_historial
    WHERE id_cat_hermanos = ?
      AND tipo = ?
    ORDER BY fecha_cambio ASC
  ");
  $st->execute([$id_cat_hermanos, $tipo]);

  $out = [];
  while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
    $fc = (string)($r['fecha_cambio'] ?? '');
    if ($fc === '') continue;

    try { $dt = new DateTime($fc); }
    catch (Throwable $e) { continue; }

    $out[] = [
      'fecha_cambio' => $dt,
      'precio_anterior' => (float)($r['precio_anterior'] ?? 0),
      'precio_nuevo' => (float)($r['precio_nuevo'] ?? 0),
    ];
  }
  return $out;
}

/**
 * Devuelve el precio aplicable en una fecha dada según historial:
 * - Si fecha < primer cambio => usa precio_anterior del primer registro
 * - Si fecha >= un cambio => usa precio_nuevo del último cambio <= fecha
 * - Si no hay historial => fallback_actual
 */
function precio_en_fecha(array $historial, DateTime $fecha, float $fallback_actual): float {
  if (count($historial) === 0) return $fallback_actual;

  $primero = $historial[0];
  /** @var DateTime $fc0 */
  $fc0 = $primero['fecha_cambio'];

  if ($fecha < $fc0) {
    $pa = (float)$primero['precio_anterior'];
    return $pa > 0 ? $pa : $fallback_actual;
  }

  $precio = $fallback_actual;
  foreach ($historial as $h) {
    /** @var DateTime $fc */
    $fc = $h['fecha_cambio'];
    if ($fc <= $fecha) {
      $pn = (float)$h['precio_nuevo'];
      if ($pn > 0) $precio = $pn;
    } else {
      break;
    }
  }
  return $precio;
}

/**
 * ✅ ANUAL: devuelve el precio del año tomando el valor vigente AL FINAL DEL AÑO (31/12 23:59:59)
 * Esto garantiza:
 * - Si hubo varios cambios en el año => toma el último de ese año
 * - Años anteriores => toma el último de ese año (no “arrastra” cambios de años posteriores)
 */
function precio_anual_en_anio(array $historialAnual, int $anio, float $fallback_actual): float {
  $finAnio = new DateTime(sprintf('%04d-12-31 23:59:59', $anio));
  return precio_en_fecha($historialAnual, $finAnio, $fallback_actual);
}

try {
  if (!function_exists('json_out')) {
    http_response_code(500);
    echo json_encode([
      'exito' => false,
      'mensaje' => 'Router no inicializado (json_out no disponible). Llamá este módulo vía api.php?action=...'
    ], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if (!isset($pdo) || !($pdo instanceof PDO)) {
    json_out(['exito' => false, 'mensaje' => 'Conexión PDO no disponible.'], 500);
  }

  $id_alumno = isset($_GET['id_alumno']) ? (int)$_GET['id_alumno'] : 0;

  $family_count = isset($_GET['family_count']) ? (int)$_GET['family_count'] : 1;
  if ($family_count < 1) $family_count = 1;

  $anio = isset($_GET['anio']) ? (int)$_GET['anio'] : (int)date('Y');
  if ($anio < 2000 || $anio > 2100) $anio = (int)date('Y');

  if ($id_alumno <= 0) json_out(['exito' => false, 'mensaje' => 'Falta id_alumno válido.'], 400);

  if (!table_exists($pdo, 'alumnos')) json_out(['exito' => false, 'mensaje' => "No existe la tabla 'alumnos'."], 500);
  if (!table_exists($pdo, 'categoria_monto')) json_out(['exito' => false, 'mensaje' => "No existe la tabla 'categoria_monto'."], 500);

  // 1) Cómo se relaciona alumnos con categoria_monto
  $alumnosCatCol = null;
  $candidates = ['id_cat_monto', 'id_categoria_monto', 'idCatMonto'];
  foreach ($candidates as $c) {
    if (column_exists($pdo, 'alumnos', $c)) { $alumnosCatCol = $c; break; }
  }

  $usaCategoria = false;
  $alumnosCategoriaCol = null;

  if ($alumnosCatCol === null) {
    foreach (['id_categoria', 'idCategoria', 'id_cat', 'idCategoriaAlumno'] as $c) {
      if (column_exists($pdo, 'alumnos', $c)) { $alumnosCategoriaCol = $c; break; }
    }

    if ($alumnosCategoriaCol !== null && table_exists($pdo, 'categoria')) {
      if (column_exists($pdo, 'categoria', 'id_cat_monto')) {
        if (!column_exists($pdo, 'categoria', 'id_categoria')) {
          json_out([
            'exito' => false,
            'mensaje' => "Existe tabla 'categoria' pero no encuentro columna 'id_categoria' para el JOIN.",
            'debug' => ['alumnos_categoria_col' => $alumnosCategoriaCol]
          ], 500);
        }
        $usaCategoria = true;
      }
    }
  }

  if ($alumnosCatCol === null && !$usaCategoria) {
    json_out([
      'exito' => false,
      'mensaje' => "No encuentro cómo vincular 'alumnos' con 'categoria_monto'. Falta 'alumnos.id_cat_monto' (o equivalente) o una tabla 'categoria' con 'id_cat_monto'.",
      'debug' => [
        'alumnos_columns_checked' => array_merge($candidates, ['id_categoria','idCategoria','id_cat','idCategoriaAlumno']),
      ]
    ], 500);
  }

  // 2) Obtener base de categoria_monto
  if ($usaCategoria) {
    $sql = "
      SELECT
        a.id_alumno,
        c.id_cat_monto,
        cm.nombre_categoria,
        cm.monto_mensual AS base_monto_mensual,
        cm.monto_anual   AS base_monto_anual
      FROM alumnos a
      INNER JOIN categoria c        ON c.id_categoria = a.`$alumnosCategoriaCol`
      INNER JOIN categoria_monto cm ON cm.id_cat_monto = c.id_cat_monto
      WHERE a.id_alumno = ?
      LIMIT 1
    ";
  } else {
    $sql = "
      SELECT
        a.id_alumno,
        a.`$alumnosCatCol` AS id_cat_monto,
        cm.nombre_categoria,
        cm.monto_mensual AS base_monto_mensual,
        cm.monto_anual   AS base_monto_anual
      FROM alumnos a
      INNER JOIN categoria_monto cm ON cm.id_cat_monto = a.`$alumnosCatCol`
      WHERE a.id_alumno = ?
      LIMIT 1
    ";
  }

  $st = $pdo->prepare($sql);
  $st->execute([$id_alumno]);
  $row = $st->fetch(PDO::FETCH_ASSOC);

  if (!$row) json_out(['exito' => false, 'mensaje' => 'No se encontró el alumno o su categoría de monto.'], 404);

  $id_cat_monto     = (int)($row['id_cat_monto'] ?? 0);
  $nombre_categoria = (string)($row['nombre_categoria'] ?? '');
  $base_mensual     = (float)($row['base_monto_mensual'] ?? 0);
  $base_anual       = (float)($row['base_monto_anual'] ?? 0);

  // Defaults: base categoria_monto
  $monto_mensual_actual = $base_mensual;
  $monto_anual_actual   = $base_anual;

  $warning = null;
  $override_aplicado = false;

  // 3) Override por hermanos (EXACT MATCH) + historial por fecha
  $montos_por_periodo = []; // [1..12] mensual por mes
  $id_cat_hermanos = 0;

  if ($family_count >= 2 && table_exists($pdo, 'categoria_hermanos')) {
    $colCantidad = null;
    foreach (['cantidad_hermanos', 'cantidad', 'cant_hermanos'] as $c) {
      if (column_exists($pdo, 'categoria_hermanos', $c)) { $colCantidad = $c; break; }
    }
    $tieneActivo = column_exists($pdo, 'categoria_hermanos', 'activo');

    if (!$colCantidad) {
      $warning = "La tabla 'categoria_hermanos' existe, pero no se encontró una columna de cantidad (cantidad_hermanos/cantidad/cant_hermanos). Se usará el monto base.";
    } else {
      // Buscar regla exacta
      $sqlOv = "
        SELECT id_cat_hermanos, monto_mensual, monto_anual, `$colCantidad` AS cant_regla
        FROM categoria_hermanos
        WHERE id_cat_monto = ?
          AND `$colCantidad` = ?
          " . ($tieneActivo ? "AND activo = 1" : "") . "
        LIMIT 1
      ";
      $st2 = $pdo->prepare($sqlOv);
      $st2->execute([$id_cat_monto, $family_count]);
      $ov = $st2->fetch(PDO::FETCH_ASSOC);

      if ($ov) {
        $id_cat_hermanos = (int)($ov['id_cat_hermanos'] ?? 0);
        $mm = (float)($ov['monto_mensual'] ?? 0);
        $ma = (float)($ov['monto_anual'] ?? 0);

        if ($mm > 0) $monto_mensual_actual = $mm;
        if ($ma > 0) $monto_anual_actual   = $ma;

        $override_aplicado = true;

        // Historial (si existe) para MENSUAL / ANUAL
        $histMensual = $id_cat_hermanos > 0 ? cargar_historial($pdo, $id_cat_hermanos, 'MENSUAL') : [];
        $histAnual   = $id_cat_hermanos > 0 ? cargar_historial($pdo, $id_cat_hermanos, 'ANUAL')   : [];

        // ✅ Mensual por mes (periodos 1..12) -> precio al 1° de cada mes
        for ($mes = 1; $mes <= 12; $mes++) {
          $fecha = new DateTime(sprintf('%04d-%02d-01', $anio, $mes));
          $montos_por_periodo[$mes] = precio_en_fecha($histMensual, $fecha, $monto_mensual_actual);
        }

        // ✅ ANUAL por año -> precio AL FIN DEL AÑO (último cambio del año)
        $monto_anual_historico = precio_anual_en_anio($histAnual, $anio, $monto_anual_actual);
        if ($monto_anual_historico > 0) $monto_anual_actual = $monto_anual_historico;

      } else {
        $warning =
          "No hay configuración de hermanos para {$family_count} integrantes en la categoría '" .
          ($nombre_categoria ?: "ID {$id_cat_monto}") .
          "'. Se usará el monto base. Agregá un registro en 'categoria_hermanos' con id_cat_monto={$id_cat_monto} y {$colCantidad}={$family_count} (monto_mensual / monto_anual).";
      }
    }
  }

  // Si no hubo override (o family_count=1), montos por período son uniformes con base
  if (count($montos_por_periodo) === 0) {
    for ($mes = 1; $mes <= 12; $mes++) $montos_por_periodo[$mes] = $monto_mensual_actual;
  }

  // Monto mensual "referencial" para mostrar arriba:
  // - si el año es el actual -> mes actual
  // - si es otro año -> enero
  $mesRef = ($anio === (int)date('Y')) ? (int)date('n') : 1;
  $monto_mensual_referencial = (float)($montos_por_periodo[$mesRef] ?? $monto_mensual_actual);

  json_out([
    'exito' => true,
    'id_alumno' => $id_alumno,
    'id_cat_monto' => $id_cat_monto,
    'categoria_nombre' => $nombre_categoria,

    'anio' => $anio,
    'family_count' => $family_count,

    // base categoria_monto
    'base_monto_mensual' => $base_mensual,
    'base_monto_anual' => $base_anual,

    // efectivos (con hermanos + histórico)
    'monto_mensual' => $monto_mensual_referencial,
    'monto_anual' => $monto_anual_actual,
    'montos_por_periodo' => $montos_por_periodo, // 👈 CLAVE

    'override_aplicado' => $override_aplicado,
    'id_cat_hermanos' => $id_cat_hermanos,
    'warning' => $warning,

    'debug' => [
      'usa_categoria' => $usaCategoria,
      'alumnos_cat_col' => $alumnosCatCol,
      'alumnos_categoria_col' => $alumnosCategoriaCol,
    ]
  ]);

} catch (Throwable $e) {
  if (function_exists('json_out')) {
    json_out([
      'exito' => false,
      'mensaje' => 'Error al obtener monto por categoría.',
      'detalle' => $e->getMessage(),
    ], 500);
  }

  http_response_code(500);
  echo json_encode([
    'exito' => false,
    'mensaje' => 'Error al obtener monto por categoría.',
    'detalle' => $e->getMessage(),
  ], JSON_UNESCAPED_UNICODE);
}