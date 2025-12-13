<?php
// modules/pagos/registrar_pago.php
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    /* ==========================================================
       1) Leer payload
       ========================================================== */
    $payload = json_decode(file_get_contents('php://input'), true) ?: [];

    $idAlumno  = isset($payload['id_alumno']) ? (int)$payload['id_alumno'] : 0;
    $periodos  = isset($payload['periodos']) && is_array($payload['periodos']) ? $payload['periodos'] : [];
    $condonar  = !empty($payload['condonar']);
    $anioInput = isset($payload['anio']) ? (int)$payload['anio'] : (int)date('Y');

    // Medio de pago obligatorio desde el frontend, pero aquí lo manejamos tolerante
    $idMedioPago = isset($payload['id_medio_pago']) && $payload['id_medio_pago'] !== ''
        ? (int)$payload['id_medio_pago'] : null;

    // Monto libre / unitario
    $montoLibre = isset($payload['monto_libre']) ? (int)$payload['monto_libre'] : 0;
    $montoUI    = isset($payload['monto_unitario']) ? (int)$payload['monto_unitario'] : null;

    // Montos por periodo que vienen del modal (1..12, 13, 14, 15, 16, etc.)
    $montosPorPeriodo = [];
    if (!empty($payload['montos_por_periodo']) && is_array($payload['montos_por_periodo'])) {
        foreach ($payload['montos_por_periodo'] as $k => $v) {
            $kk = (int)$k;
            $vv = (int)$v;
            $montosPorPeriodo[$kk] = $vv;
        }
    }

    /* ==========================================================
       2) Grupo familiar (ids_familia)
       ========================================================== */
    $aplicarFamilia = !empty($payload['aplicar_a_familia']);
    $idsFamilia     = [];

    if ($aplicarFamilia && isset($payload['ids_familia']) && is_array($payload['ids_familia'])) {
        foreach ($payload['ids_familia'] as $idf) {
            $idClean = (int)$idf;
            if ($idClean > 0 && $idClean !== $idAlumno) {
                $idsFamilia[$idClean] = true; // set
            }
        }
    }
    $idsFamilia = array_keys($idsFamilia);

    /* ==========================================================
       3) Validaciones mínimas
       ========================================================== */
    if ($idAlumno <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID de alumno inválido'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if (empty($periodos)) {
        echo json_encode(['exito' => false, 'mensaje' => 'No se enviaron períodos a registrar'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($anioInput < 2000 || $anioInput > 2100) {
        $anioInput = (int)date('Y');
    }

    $estadoRegistrar = $condonar ? 'condonado' : 'pagado';

    // FECHA DE PAGO: conserva día y mes actuales, pero con el año seleccionado
    $hoy        = new DateTime();
    $diaActual  = (int)$hoy->format('d');
    $mesActual  = (int)$hoy->format('m');
    $fechaPago  = sprintf('%04d-%02d-%02d', $anioInput, $mesActual, $diaActual);

    /* ==========================================================
       4) Helpers de cálculo
       ========================================================== */

    // Devuelve el monto que se registra para un periodo concreto
    $resolverMonto = function (
        bool $condonar,
        ?int $montoUI,
        int $montoLibre,
        array $montosPorPeriodo,
        int $periodo
    ): int {
        if ($condonar) {
            return 0;
        }
        if (isset($montosPorPeriodo[$periodo]) && is_int($montosPorPeriodo[$periodo]) && $montosPorPeriodo[$periodo] >= 0) {
            return (int)$montosPorPeriodo[$periodo];
        }
        if (!is_null($montoUI) && $montoUI > 0) {
            return (int)$montoUI;
        }
        if ($montoLibre > 0) {
            return (int)$montoLibre;
        }
        return 0;
    };

    // Separa la selección en:
    //   - meses explícitos (1..12)
    //   - matrícula (14)
    //   - segmentos únicos (13, 15, 16) con su TOTAL
    $parsearSeleccion = function (array $periodos, array $montosPorPeriodo, bool $condonar): array {
        $mesesExplicitos = []; // 1..12
        $matricula       = false;
        $segmentos       = []; // cada item: ['id_mes' => 13|15|16, 'total' => X]

        foreach ($periodos as $p) {
            $p = (int)$p;
            if ($p >= 1 && $p <= 12) {
                $mesesExplicitos[$p] = true;
            } elseif ($p === 14) {
                $matricula = true;
            } elseif ($p === 13) {
                $total = isset($montosPorPeriodo[13]) ? (int)$montosPorPeriodo[13] : 0;
                $segmentos[] = [
                    'id_mes' => 13,
                    'total'  => $condonar ? 0 : $total,
                ];
            } elseif ($p === 15) {
                $total = isset($montosPorPeriodo[15]) ? (int)$montosPorPeriodo[15] : 0;
                $segmentos[] = [
                    'id_mes' => 15,
                    'total'  => $condonar ? 0 : $total,
                ];
            } elseif ($p === 16) {
                $total = isset($montosPorPeriodo[16]) ? (int)$montosPorPeriodo[16] : 0;
                $segmentos[] = [
                    'id_mes' => 16,
                    'total'  => $condonar ? 0 : $total,
                ];
            }
        }

        ksort($mesesExplicitos);

        return [
            'mesesExplicitos' => array_keys($mesesExplicitos),
            'matricula'       => $matricula,
            'segmentos'       => $segmentos,
        ];
    };

    // Construye un mapa mes => monto para meses 1..12
    $construirMontosMensuales = function (
        array $mesesExplicitos,
        array $montosPorPeriodo,
        bool $condonar,
        ?int $montoUI,
        int $montoLibre
    ) use ($resolverMonto): array {
        $map = [];

        foreach ($mesesExplicitos as $m) {
            $m = (int)$m;
            if ($m < 1 || $m > 12) {
                continue;
            }
            $map[$m] = $resolverMonto($condonar, $montoUI, $montoLibre, $montosPorPeriodo, $m);
        }

        ksort($map);
        return $map;
    };

    /* ==========================================================
       5) Interpretar selección del modal
       ========================================================== */
    $seleccion        = $parsearSeleccion($periodos, $montosPorPeriodo, $condonar);
    $mesesExplicitos  = $seleccion['mesesExplicitos']; // 1..12
    $matriculaSel     = $seleccion['matricula'];       // bool
    $segmentos        = $seleccion['segmentos'];       // 13, 15, 16

    $montosPorMes = $construirMontosMensuales(
        $mesesExplicitos,
        $montosPorPeriodo,
        $condonar,
        $montoUI,
        $montoLibre
    );

    /* ==========================================================
       6) Preparar consultas
       ========================================================== */
    // Pagos existentes por alumno + año
    $stExist = $pdo->prepare("
        SELECT id_mes, estado
          FROM pagos
         WHERE id_alumno = :id_alumno
           AND YEAR(fecha_pago) = :anio
    ");

    // Insert genérico (incluye id_medio_pago)
    $stIns = $pdo->prepare("
        INSERT INTO pagos (id_alumno, id_mes, fecha_pago, estado, monto_pago, id_medio_pago)
        VALUES (:id_alumno, :id_mes, :fecha_pago, :estado, :monto_pago, :id_medio_pago)
    ");

    /* ==========================================================
       7) Lista final de alumnos a procesar
       ========================================================== */
    $alumnosObjetivo = [$idAlumno];

    if ($aplicarFamilia && !empty($idsFamilia)) {
        $set = [];
        foreach ($alumnosObjetivo as $idp) {
            $set[(int)$idp] = true;
        }
        foreach ($idsFamilia as $idf) {
            $set[(int)$idf] = true;
        }
        $alumnosObjetivo = array_map('intval', array_keys($set));
        sort($alumnosObjetivo);
    }

    /* ==========================================================
       8) Registrar para cada alumno (principal + familia)
       ========================================================== */
    $totalInsertados   = 0;
    $detallePorAlumno  = [];

    $pdo->beginTransaction();

    foreach ($alumnosObjetivo as $idA) {
        $idA = (int)$idA;
        if ($idA <= 0) {
            continue;
        }

        // Pagos ya existentes de este alumno en ese año
        $stExist->execute([
            ':id_alumno' => $idA,
            ':anio'      => $anioInput,
        ]);
        $existentes = $stExist->fetchAll(PDO::FETCH_ASSOC);

        $yaPorMes = [];
        foreach ($existentes as $row) {
            $yaPorMes[(int)$row['id_mes']] = (string)$row['estado'];
        }

        $insertadosAlumno   = 0;
        $yaRegistradosAlumno = [];

        /* ---------- 8.1 Meses explícitos 1..12 ---------- */
        foreach ($montosPorMes as $mes => $monto) {
            $mes = (int)$mes;
            if ($mes < 1 || $mes > 12) {
                continue;
            }

            if (array_key_exists($mes, $yaPorMes)) {
                $yaRegistradosAlumno[] = [
                    'periodo' => $mes,
                    'estado'  => $yaPorMes[$mes],
                ];
                continue;
            }

            $montoFinal = $condonar ? 0 : max(0, (int)$monto);

            $stIns->execute([
                ':id_alumno'     => $idA,
                ':id_mes'        => $mes,
                ':fecha_pago'    => $fechaPago,
                ':estado'        => $estadoRegistrar,
                ':monto_pago'    => $montoFinal,
                ':id_medio_pago' => ($idMedioPago && $idMedioPago > 0) ? $idMedioPago : null,
            ]);

            $insertadosAlumno++;
            $totalInsertados++;
        }

        /* ---------- 8.2 Matrícula (14) ---------- */
        if ($matriculaSel) {
            $mesMat = 14;

            if (array_key_exists($mesMat, $yaPorMes)) {
                $yaRegistradosAlumno[] = [
                    'periodo' => $mesMat,
                    'estado'  => $yaPorMes[$mesMat],
                ];
            } else {
                $montoMatricula = $resolverMonto($condonar, $montoUI, $montoLibre, $montosPorPeriodo, $mesMat);
                $montoMatricula = $condonar ? 0 : max(0, (int)$montoMatricula);

                $stIns->execute([
                    ':id_alumno'     => $idA,
                    ':id_mes'        => $mesMat,
                    ':fecha_pago'    => $fechaPago,
                    ':estado'        => $estadoRegistrar,
                    ':monto_pago'    => $montoMatricula,
                    ':id_medio_pago' => ($idMedioPago && $idMedioPago > 0) ? $idMedioPago : null,
                ]);

                $insertadosAlumno++;
                $totalInsertados++;
            }
        }

        /* ---------- 8.3 Anual / Mitades (13, 15, 16) ---------- */
        foreach ($segmentos as $seg) {
            $idMesSeg = (int)($seg['id_mes'] ?? 0);  // 13 | 15 | 16
            $montoSeg = (int)($seg['total']  ?? 0);

            if (!$idMesSeg) {
                continue;
            }

            if (array_key_exists($idMesSeg, $yaPorMes)) {
                $yaRegistradosAlumno[] = [
                    'periodo' => $idMesSeg,
                    'estado'  => $yaPorMes[$idMesSeg],
                ];
                continue;
            }

            $montoFinalSeg = $condonar ? 0 : max(0, $montoSeg);

            $stIns->execute([
                ':id_alumno'     => $idA,
                ':id_mes'        => $idMesSeg,
                ':fecha_pago'    => $fechaPago,
                ':estado'        => $estadoRegistrar,
                ':monto_pago'    => $montoFinalSeg,
                ':id_medio_pago' => ($idMedioPago && $idMedioPago > 0) ? $idMedioPago : null,
            ]);

            $insertadosAlumno++;
            $totalInsertados++;
        }

        $detallePorAlumno[] = [
            'id_alumno'      => $idA,
            'insertados'     => $insertadosAlumno,
            'ya_registrados' => $yaRegistradosAlumno,
        ];
    }

    $pdo->commit();

    /* ==========================================================
       9) Respuesta
       ========================================================== */
    if ($totalInsertados > 0) {
        echo json_encode([
            'exito'              => true,
            'insertados_total'   => $totalInsertados,
            'familia_aplicada'   => $aplicarFamilia && count($alumnosObjetivo) > 1,
            'alumnos_procesados' => count($alumnosObjetivo),
            'detalle_por_alumno' => $detallePorAlumno,
        ], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode([
            'exito'              => false,
            'mensaje'            => 'No se insertaron registros (todos ya estaban cargados para ese año).',
            'familia_aplicada'   => $aplicarFamilia && count($alumnosObjetivo) > 1,
            'alumnos_procesados' => count($alumnosObjetivo),
            'detalle_por_alumno' => $detallePorAlumno,
        ], JSON_UNESCAPED_UNICODE);
    }

} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(200);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al registrar pagos: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
