<?php
/**
 * Agrupa pagos por el MES de la FECHA DE PAGO (MONTH(fecha_pago)),
 * pero en cada fila devuelve también el MES PAGADO (p.id_mes).
 *
 * Precio:
 *  - $4000 por defecto
 *  - $3500 si el alumno registró exactamente 6 pagos dentro del mismo YYYY-MM (descuento “6 juntos”).
 *
 * Respuesta:
 * {
 *   "exito": true,
 *   "datos": [
 *     { "id_mes": 8, "nombre": "AGOSTO", "pagos": [ { ... "Mes_Pagado": "MARZO", "Mes_Cobro": "AGOSTO" } ] },
 *     ...
 *   ],
 *   "total_alumnos": 1234,
 *   "total_socios": 1234
 * }
 */

require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    if (!($pdo instanceof PDO)) {
        throw new RuntimeException('Conexión PDO no disponible.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    /* ===== Total de alumnos activos ===== */
    $stmtTot = $pdo->query("SELECT COUNT(*) AS c FROM alumnos WHERE activo = 1");
    $rowTot  = $stmtTot->fetch(PDO::FETCH_ASSOC);
    $totalActivos = (int)($rowTot['c'] ?? 0);

    /* ===== Pagos:
       - m_cobro: mes por FECHA de pago  (AGOSTO si fecha_pago=2025-08-10)
       - m_pagado: mes PAGADO (p.id_mes) (MARZO si id_mes=3)
    */
    $sql = "
        SELECT
            p.id_pago,
            p.id_alumno,
            p.id_mes                              AS id_mes_pagado,
            p.fecha_pago,
            a.apellido_nombre,
            a.id_categoria,
            c.nombre_categoria                    AS categoria_nombre,
            MONTH(p.fecha_pago)                   AS mes_id_cobro,
            m_cobro.nombre                        AS mes_nombre_cobro,
            m_pagado.nombre                       AS mes_nombre_pagado
        FROM pagos p
        INNER JOIN alumnos a     ON a.id_alumno    = p.id_alumno
        LEFT  JOIN categoria c   ON c.id_categoria = a.id_categoria
        LEFT  JOIN meses m_cobro ON m_cobro.id_mes = MONTH(p.fecha_pago)
        LEFT  JOIN meses m_pagado ON m_pagado.id_mes = p.id_mes
        ORDER BY p.fecha_pago ASC, p.id_pago ASC
    ";
    $stmt = $pdo->query($sql);
    $pagos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    /* ===== Conteo para descuento por YYYY-MM ===== */
    $conteoPorAlumnoMesCalendario = []; // "<id_alumno>#YYYY-MM" => count
    foreach ($pagos as $row) {
        $idAlumno = (int)$row['id_alumno'];
        $ym = substr($row['fecha_pago'], 0, 7); // YYYY-MM
        $key = $idAlumno . '#' . $ym;
        if (!isset($conteoPorAlumnoMesCalendario[$key])) $conteoPorAlumnoMesCalendario[$key] = 0;
        $conteoPorAlumnoMesCalendario[$key]++;
    }

    /* ===== Agrupar por MES DE COBRO (fecha_pago) ===== */
    $porMes = []; // mes_id_cobro => ['id_mes'=>.., 'nombre'=>.., 'pagos'=>[]]

    foreach ($pagos as $row) {
        $idAlumno = (int)$row['id_alumno'];
        $fecha    = (string)$row['fecha_pago'];
        $ym       = substr($fecha, 0, 7); // YYYY-MM
        $keyAM    = $idAlumno . '#' . $ym;

        $precio = (isset($conteoPorAlumnoMesCalendario[$keyAM]) && (int)$conteoPorAlumnoMesCalendario[$keyAM] === 6)
                ? 3500 : 4000;

        // Separar apellido / nombre desde 'apellido_nombre'
        $apellido = '';
        $nombre   = '';
        $apNom    = trim((string)$row['apellido_nombre']);
        if ($apNom !== '') {
            if (strpos($apNom, ',') !== false) {          // "APELLIDO, Nombre"
                [$ap, $no] = array_map('trim', explode(',', $apNom, 2));
                $apellido = $ap;
                $nombre   = $no;
            } else {                                       // "Nombre Apellido"
                $partes = preg_split('/\s+/', $apNom);
                if (count($partes) >= 2) {
                    $apellido = array_pop($partes);
                    $nombre   = implode(' ', $partes);
                } else {
                    $nombre = $apNom;
                }
            }
        }

        $idMesCobro  = (int)($row['mes_id_cobro'] ?? 0);
        $nomMesCobro = (string)($row['mes_nombre_cobro'] ?? '');
        $nomMesPagado= (string)($row['mes_nombre_pagado'] ?? '');

        // fallbacks si no hay join
        if ($nomMesCobro === '' || $nomMesPagado === '') {
            $nombres = [1=>'ENERO',2=>'FEBRERO',3=>'MARZO',4=>'ABRIL',5=>'MAYO',6=>'JUNIO',7=>'JULIO',8=>'AGOSTO',9=>'SEPTIEMBRE',10=>'OCTUBRE',11=>'NOVIEMBRE',12=>'DICIEMBRE'];
            if ($nomMesCobro === '')  $nomMesCobro  = $nombres[$idMesCobro] ?? "MES $idMesCobro";
            if ($nomMesPagado === '') $nomMesPagado = $nombres[(int)$row['id_mes_pagado']] ?? ("MES ".(int)$row['id_mes_pagado']);
        }

        if (!isset($porMes[$idMesCobro])) {
            $porMes[$idMesCobro] = [
                'id_mes' => $idMesCobro,        // mes de FECHA DE PAGO
                'nombre' => $nomMesCobro,
                'pagos'  => [],
            ];
        }

        $porMes[$idMesCobro]['pagos'][] = [
            'ID_Alumno'        => $idAlumno,
            'Apellido'         => $apellido,
            'Nombre'           => $nombre,
            'Precio'           => (float)$precio,
            'Nombre_Categoria' => (string)($row['categoria_nombre'] ?? ''),
            'fechaPago'        => $fecha,
            'Mes_Pagado'       => $nomMesPagado,  // <- MES QUE ABONÓ (p.id_mes)
            'Mes_Cobro'        => $nomMesCobro,   // <- MES DE FECHA DE PAGO (agrupador)
        ];
    }

    ksort($porMes);
    $datos = array_values($porMes);

    echo json_encode([
        'exito'          => true,
        'datos'          => $datos,
        'total_alumnos'  => $totalActivos,
        'total_socios'   => $totalActivos, // compatibilidad
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
