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

    $payload = json_decode(file_get_contents('php://input'), true) ?: [];

    // ===== Payload base =====
    $idAlumno      = isset($payload['id_alumno']) ? (int)$payload['id_alumno'] : 0;
    $periodos      = isset($payload['periodos']) && is_array($payload['periodos']) ? $payload['periodos'] : [];
    $condonar      = !empty($payload['condonar']);
    $anioInput     = isset($payload['anio']) ? (int)$payload['anio'] : (int)date('Y');

    // NUEVO: medio de pago (puede ser null)
    $idMedioPago   = isset($payload['id_medio_pago']) && $payload['id_medio_pago'] !== ''
                     ? (int)$payload['id_medio_pago'] : null;

    // Compat: monto_libre / monto_unitario
    $montoLibre = isset($payload['monto_libre']) ? (int)$payload['monto_libre'] : 0;
    $montoUI    = isset($payload['monto_unitario']) ? (int)$payload['monto_unitario'] : null;

    // Montos por período (puede incluir: 1..12, 13, 14, 15, 16)
    $montosPorPeriodo = [];
    if (isset($payload['montos_por_periodo']) && is_array($payload['montos_por_periodo'])) {
        foreach ($payload['montos_por_periodo'] as $k => $v) {
            $kk = (int)$k;
            $vv = (int)$v;
            $montosPorPeriodo[$kk] = $vv;
        }
    }

    // ===== NUEVO: aplicar a grupo familiar =====
    $aplicarFamilia = !empty($payload['aplicar_a_familia']);
    $idsFamilia     = [];
    if ($aplicarFamilia && isset($payload['ids_familia']) && is_array($payload['ids_familia'])) {
        foreach ($payload['ids_familia'] as $idf) {
            $idClean = (int)$idf;
            if ($idClean > 0 && $idClean !== $idAlumno) {
                $idsFamilia[$idClean] = true; // usar como set
            }
        }
    }
    $idsFamilia = array_keys($idsFamilia);

    // ===== Validaciones mínimas =====
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

    // FECHA DE PAGO: mismo día/mes de hoy, año = $anioInput (seleccionado)
    $hoy = new DateTime();
    $diaActual     = (int)$hoy->format('d');
    $mesActual     = (int)$hoy->format('m');
    $fechaPagoStr  = sprintf('%04d-%02d-%02d', $anioInput, $mesActual, $diaActual);

    // ========= Helpers =========
    $resolverMontoMensual = function (bool $condonar, ?int $montoUI, int $montoLibre, array $montos, int $periodo) : int {
        if ($condonar) return 0;
        if (isset($montos[$periodo]) && is_int($montos[$periodo]) && $montos[$periodo] >= 0) {
            return (int)$montos[$periodo];
        }
        if (is_int($montoUI) && $montoUI > 0) return $montoUI;
        if ($montoLibre > 0) return $montoLibre;
        return 0;
    };

    $distribuirEntero = function (int $total, int $n) : array {
        if ($n <= 0) return [];
        if ($total <= 0) return array_fill(0, $n, 0);
        $base = intdiv($total, $n);
        $resto = $total - ($base * $n);
        $out = [];
        for ($i = 0; $i < $n; $i++) {
            $out[] = $base + ($i < $resto ? 1 : 0);
        }
        return $out;
    };

    $parsearSeleccion = function(array $periodos, array $montosPorPeriodo) use ($condonar) {
        $mesesExp = [];
        $matricula = false;
        $segs = [];

        foreach ($periodos as $p) {
            $p = (int)$p;
            if ($p >= 1 && $p <= 12) {
                $mesesExp[$p] = true;
            } elseif ($p === 14) {
                $matricula = true;
            } elseif ($p === 13) {
                $total = (int)($montosPorPeriodo[13] ?? 0);
                $segs[] = ['tipo'=>'full', 'meses'=>range(1,12), 'total'=>$condonar ? 0 : $total];
            } elseif ($p === 15) {
                $total = (int)($montosPorPeriodo[15] ?? 0);
                $segs[] = ['tipo'=>'h1', 'meses'=>range(1,7), 'total'=>$condonar ? 0 : $total];
            } elseif ($p === 16) {
                $total = (int)($montosPorPeriodo[16] ?? 0);
                $segs[] = ['tipo'=>'h2', 'meses'=>range(8,12), 'total'=>$condonar ? 0 : $total];
            }
        }

        ksort($mesesExp);
        return [
            'mesesExplicitos' => array_keys($mesesExp),
            'matricula'       => $matricula,
            'segmentosAnuales'=> $segs,
        ];
    };

    $construirMontosMensuales = function(
        array $mesesExplicitos,
        array $segmentosAnuales,
        array $montosPorPeriodo,
        bool $condonar,
        ?int $montoUI,
        int $montoLibre
    ) use ($resolverMontoMensual, $distribuirEntero) {

        $map = []; // mes => monto

        foreach ($mesesExplicitos as $m) {
            $map[$m] = $resolverMontoMensual($condonar, $montoUI, $montoLibre, $montosPorPeriodo, (int)$m);
        }

        foreach ($segmentosAnuales as $seg) {
            $mesesSeg = $seg['meses'];
            $totalSeg = (int)($seg['total'] ?? 0);
            $n = count($mesesSeg);
            $dist = $distribuirEntero(max(0, $totalSeg), $n);

            foreach ($mesesSeg as $i => $mes) {
                if (!isset($map[$mes])) {
                    $map[$mes] = $condonar ? 0 : (int)$dist[$i];
                }
            }
        }

        ksort($map);
        return $map; // solo 1..12
    };

    // ===================== LÓGICA PRINCIPAL =====================
    $seleccion = $parsearSeleccion($periodos, $montosPorPeriodo);
    $mesesExplicitos  = $seleccion['mesesExplicitos'];
    $matriculaSel     = $seleccion['matricula'];
    $segmentosAnuales = $seleccion['segmentosAnuales'];

    $montosPorMes = $construirMontosMensuales(
        $mesesExplicitos,
        $segmentosAnuales,
        $montosPorPeriodo,
        $condonar,
        $montoUI,
        $montoLibre
    );

    // ===== Preparar consultas =====
    $stExist = $pdo->prepare("
        SELECT id_mes, estado
          FROM pagos
         WHERE id_alumno = :id_alumno
           AND YEAR(fecha_pago) = :anio
    ");

    // NUEVO: insert con id_medio_pago
    $stIns = $pdo->prepare("
        INSERT INTO pagos (id_alumno, id_mes, fecha_pago, estado, monto_pago, id_medio_pago)
        VALUES (:id_alumno, :id_mes, :fecha_pago, :estado, :monto_pago, :id_medio_pago)
    ");

    // ===== Armar lista final de alumnos a procesar =====
    $alumnosObjetivo = [$idAlumno];
    if ($aplicarFamilia && !empty($idsFamilia)) {
        $set = [];
        foreach ($alumnosObjetivo as $idp) $set[$idp] = true;
        foreach ($idsFamilia as $idf) $set[(int)$idf] = true;
        $alumnosObjetivo = array_map('intval', array_keys($set));
    }

    $totalInsertados = 0;
    $detallePorAlumno = [];

    $pdo->beginTransaction();

    foreach ($alumnosObjetivo as $idA) {
        if ($idA <= 0) continue;

        $stExist->execute([
            ':id_alumno' => $idA,
            ':anio'      => $anioInput,
        ]);
        $existentes = $stExist->fetchAll(PDO::FETCH_ASSOC);

        $yaPorMes = [];
        foreach ($existentes as $row) {
            $yaPorMes[(int)$row['id_mes']] = (string)$row['estado'];
        }

        $insertadosAlumno = 0;
        $yaRegistradosAlumno = [];

        // 1) Insertar MESES 1..12
        foreach ($montosPorMes as $mes => $monto) {
            $mes = (int)$mes;
            if ($mes < 1 || $mes > 12) continue;

            if (array_key_exists($mes, $yaPorMes)) {
                $yaRegistradosAlumno[] = [
                    'periodo' => $mes,
                    'estado'  => $yaPorMes[$mes],
                ];
                continue;
            }

            $stIns->execute([
                ':id_alumno'     => $idA,
                ':id_mes'        => $mes,
                ':fecha_pago'    => $fechaPagoStr,
                ':estado'        => $estadoRegistrar,
                ':monto_pago'    => $condonar ? 0 : (int)max(0, $monto),
                ':id_medio_pago' => ($idMedioPago && $idMedioPago > 0) ? $idMedioPago : null,
            ]);

            $insertadosAlumno++;
            $totalInsertados++;
        }

        // 2) Insertar MATRÍCULA si corresponde (14)
        if ($matriculaSel) {
            $mes = 14;
            if (!array_key_exists($mes, $yaPorMes)) {
                $montoMatricula = $resolverMontoMensual($condonar, $montoUI, $montoLibre, $montosPorPeriodo, 14);

                $stIns->execute([
                    ':id_alumno'     => $idA,
                    ':id_mes'        => $mes,
                    ':fecha_pago'    => $fechaPagoStr,
                    ':estado'        => $estadoRegistrar,
                    ':monto_pago'    => $condonar ? 0 : (int)max(0, $montoMatricula),
                    ':id_medio_pago' => ($idMedioPago && $idMedioPago > 0) ? $idMedioPago : null,
                ]);
                $insertadosAlumno++;
                $totalInsertados++;
            } else {
                $yaRegistradosAlumno[] = [
                    'periodo' => 14,
                    'estado'  => $yaPorMes[14],
                ];
            }
        }

        $detallePorAlumno[] = [
            'id_alumno'      => $idA,
            'insertados'     => $insertadosAlumno,
            'ya_registrados' => $yaRegistradosAlumno,
        ];
    }

    $pdo->commit();

    if ($totalInsertados > 0) {
        echo json_encode([
            'exito'                 => true,
            'insertados_total'      => $totalInsertados,
            'familia_aplicada'      => $aplicarFamilia && count($alumnosObjetivo) > 1,
            'alumnos_procesados'    => count($alumnosObjetivo),
            'detalle_por_alumno'    => $detallePorAlumno,
        ], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode([
            'exito'                 => false,
            'mensaje'               => 'No se insertaron registros (todos ya estaban cargados para ese año).',
            'familia_aplicada'      => $aplicarFamilia && count($alumnosObjetivo) > 1,
            'alumnos_procesados'    => count($alumnosObjetivo),
            'detalle_por_alumno'    => $detallePorAlumno,
        ], JSON_UNESCAPED_UNICODE);
    }

} catch (Throwable $e) {
    if (isset($pdo) && ($pdo instanceof PDO) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(200);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al registrar pagos: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
