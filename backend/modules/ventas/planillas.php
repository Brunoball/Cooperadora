<?php
// backend/modules/ventas/planillas.php
// Generación de planillas imprimibles para relevamiento de ventas por curso/división.
// Versión A4 vertical PDF, con diseño calcado al formato aprobado.

// IMPORTANTE:
// Este archivo NO registra ventas y NO importa Excel.
// Solo genera el PDF para que se impriman hojas por curso/división.

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

const VENTAS_PLANILLAS_NUMERO_BOT_DEFAULT = '3564 665050';

function ventas_planillas_h($value) {
    return htmlspecialchars((string)($value ?? ''), ENT_QUOTES, 'UTF-8');
}

function ventas_planillas_money($value) {
    $n = (float)($value ?? 0);
    if ($n <= 0) return '';
    return '$' . number_format($n, 0, ',', '.');
}

function ventas_planillas_normalizar_anio($value) {
    $txt = trim((string)($value ?? ''));
    $txt = str_replace(['°', 'º'], '', $txt);
    return $txt;
}

function ventas_planillas_nombre_alumno($row) {
    $apellido = trim((string)($row['apellido'] ?? ''));
    $nombre = trim((string)($row['nombre'] ?? ''));

    if ($apellido !== '' && $nombre !== '') return $apellido . ', ' . $nombre;
    if ($apellido !== '') return $apellido;
    return $nombre;
}

function ventas_planillas_producto_gan($pdo, $idProductoPrincipal) {
    // Para respetar el formato del Excel base se imprime VEN + GAN.
    // VEN toma el producto principal de la campaña. GAN intenta tomar un producto
    // de catálogo que represente ganancia/durazno/segundo concepto. Si no existe,
    // la columna se imprime igual, con precio vacío para completar a mano.
    $params = [];
    $exclude = '';
    if ($idProductoPrincipal && $idProductoPrincipal > 0) {
        $exclude = 'AND id_producto <> :id_producto_principal';
        $params[':id_producto_principal'] = $idProductoPrincipal;
    }

    $sqlPreferido = "
        SELECT id_producto, nombre, precio
        FROM ventas_productos
        WHERE activo = 1
          $exclude
          AND (
            UPPER(nombre) LIKE '%GAN%'
            OR UPPER(nombre) LIKE '%DURAZ%'
            OR UPPER(nombre) LIKE '%BONO%'
          )
        ORDER BY
          CASE
            WHEN UPPER(nombre) LIKE '%GAN%' THEN 1
            WHEN UPPER(nombre) LIKE '%DURAZ%' THEN 2
            ELSE 3
          END,
          id_producto ASC
        LIMIT 1
    ";
    $st = $pdo->prepare($sqlPreferido);
    $st->execute($params);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if ($row) return $row;

    $sqlFallback = "
        SELECT id_producto, nombre, precio
        FROM ventas_productos
        WHERE activo = 1
          $exclude
        ORDER BY id_producto ASC
        LIMIT 1
    ";
    $st = $pdo->prepare($sqlFallback);
    $st->execute($params);
    $row = $st->fetch(PDO::FETCH_ASSOC);

    return $row ?: null;
}

function ventas_planillas_obtener_campania($pdo, $idCampania) {
    if ($idCampania > 0) {
        $st = $pdo->prepare("
            SELECT
                c.*,
                p.nombre AS producto_principal_nombre,
                p.precio AS producto_principal_precio
            FROM ventas_campanias c
            LEFT JOIN ventas_productos p ON p.id_producto = c.id_producto_principal
            WHERE c.id_campania = :id
            LIMIT 1
        ");
        $st->execute([':id' => $idCampania]);
        $campania = $st->fetch(PDO::FETCH_ASSOC);
        if ($campania) return $campania;
        throw new InvalidArgumentException('No se encontró la venta/campaña seleccionada.');
    }

    $st = $pdo->query("
        SELECT
            c.*,
            p.nombre AS producto_principal_nombre,
            p.precio AS producto_principal_precio
        FROM ventas_campanias c
        LEFT JOIN ventas_productos p ON p.id_producto = c.id_producto_principal
        ORDER BY c.activo DESC, c.visible_menu DESC, c.id_campania DESC
        LIMIT 1
    ");
    $campania = $st->fetch(PDO::FETCH_ASSOC);
    if ($campania) return $campania;

    throw new InvalidArgumentException('No hay ventas/campañas cargadas para generar planillas.');
}

function ventas_planillas_obtener_alumnos($pdo, $soloActivos, $idAnio = 0, $idDivision = 0) {
    $where = [];
    $params = [];

    if ($soloActivos) {
        $where[] = 'a.activo = 1';
    }
    if ($idAnio > 0) {
        $where[] = 'a.`id_año` = :id_anio';
        $params[':id_anio'] = $idAnio;
    }
    if ($idDivision > 0) {
        $where[] = 'a.id_division = :id_division';
        $params[':id_division'] = $idDivision;
    }

    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $sql = "
        SELECT
            a.id_alumno,
            a.apellido,
            a.nombre,
            a.activo,
            a.`id_año`,
            a.id_division,
            an.nombre_año,
            d.nombre_division
        FROM alumnos a
        LEFT JOIN anio an ON an.`id_año` = a.`id_año`
        LEFT JOIN division d ON d.id_division = a.id_division
        $whereSql
        ORDER BY
            COALESCE(a.`id_año`, 999),
            COALESCE(a.id_division, 999),
            a.apellido ASC,
            a.nombre ASC
    ";

    $st = $pdo->prepare($sql);
    $st->execute($params);
    return $st->fetchAll(PDO::FETCH_ASSOC);
}

function ventas_planillas_agrupar_por_curso($alumnos) {
    $grupos = [];
    foreach ($alumnos as $alumno) {
        $anio = trim((string)($alumno['nombre_año'] ?? 'Sin año')) ?: 'Sin año';
        $division = trim((string)($alumno['nombre_division'] ?? 'Sin división')) ?: 'Sin división';
        $key = (string)($alumno['id_año'] ?? '0') . '-' . (string)($alumno['id_division'] ?? '0');

        if (!isset($grupos[$key])) {
            $grupos[$key] = [
                'anio' => $anio,
                'division' => $division,
                'id_anio' => (int)($alumno['id_año'] ?? 0),
                'id_division' => (int)($alumno['id_division'] ?? 0),
                'alumnos' => [],
            ];
        }
        $grupos[$key]['alumnos'][] = $alumno;
    }

    return array_values($grupos);
}

function ventas_planillas_upper(string $value): string
{
    return function_exists('mb_strtoupper') ? mb_strtoupper($value, 'UTF-8') : strtoupper($value);
}

function ventas_planillas_lower(string $value): string
{
    return function_exists('mb_strtolower') ? mb_strtolower($value, 'UTF-8') : strtolower($value);
}

function ventas_planillas_strlen(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function ventas_planillas_substr(string $value, int $start, ?int $length = null): string
{
    if (function_exists('mb_substr')) {
        return $length === null ? mb_substr($value, $start, null, 'UTF-8') : mb_substr($value, $start, $length, 'UTF-8');
    }
    return $length === null ? substr($value, $start) : substr($value, $start, $length);
}

function ventas_planillas_slug(string $value): string
{
    $value = trim(ventas_planillas_lower($value));
    $value = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
    $value = preg_replace('/[^a-z0-9]+/i', '_', $value) ?: 'planillas';
    return trim($value, '_') ?: 'planillas';
}

final class VentasPlanillasPdfVertical
{
    private const MM = 72 / 25.4;
    private const W = 595.275590551; // A4 vertical
    private const H = 841.88976378;

    private array $pages = [];
    private array $cmd = [];

    public function drawCourseSheet(array $grupo, array $campania, ?array $productoGan, string $numeroBot = ''): void
    {
        $this->addPage();

        $mm = self::MM;
        $W = self::W;
        $H = self::H;

        $anioCurso = ventas_planillas_normalizar_anio($grupo['anio'] ?? '');
        $divisionCurso = trim((string)($grupo['division'] ?? ''));
        $cursoCompleto = trim((string)($grupo['anio'] ?? '') . ' ' . $divisionCurso);
        $alumnos = array_values($grupo['alumnos'] ?? []);
        $cantidad = count($alumnos);
        $campaniaNombre = ventas_planillas_upper(trim((string)($campania['nombre'] ?? 'Venta escolar')));
        $precioVenTxt = ventas_planillas_money($campania['producto_principal_precio'] ?? 0);
        $precioGanTxt = $productoGan ? ventas_planillas_money($productoGan['precio'] ?? 0) : '';
        $numeroBotTxt = trim($numeroBot) !== '' ? trim($numeroBot) : VENTAS_PLANILLAS_NUMERO_BOT_DEFAULT;

        $metaY = $H - 7.9 * $mm;
        $xLeft = 2.8 * $mm;
        $xRight = $W - 2.8 * $mm;
        $this->text('Curso: ' . $cursoCompleto . ' · Alumnos: ' . $cantidad, $xLeft, $metaY, 6.5, false, 'left');
        $this->text('Número bot: ' . $numeroBotTxt, $W / 2, $metaY, 6.5, true, 'center');
        $this->text('Docente responsable: _______________________________', $xRight, $metaY, 6.5, false, 'right');

        $marginX = 5 * $mm;
        $tableW = $W - 2 * $marginX;
        $top = $H - 13 * $mm;
        $x0 = $marginX;
        $x1 = $x0 + $tableW;
        $y = $top;

        $hSchool = 7.2 * $mm;
        $hTop = 6.7 * $mm;
        $hCourse = 6.5 * $mm;
        $hCol1 = 11.1 * $mm;
        $hCol2 = 5.8 * $mm;
        $hCols = $hCol1 + $hCol2;

        // Columnas ajustadas para A4 vertical. ORDEN y APELLIDO algo más compactas,
        // y la línea de curso/precio queda alineada con CURSO/CANTIDADES.
        $colMm = [13, 74, 12, 12, 16, 16, 25];
        $widths = [];
        $used = 0.0;
        foreach ($colMm as $c) {
            $widths[] = $c * $mm;
            $used += $c * $mm;
        }
        $widths[] = $tableW - $used;
        $xs = [$x0];
        foreach ($widths as $w) $xs[] = end($xs) + $w;

        // Encabezado escuela.
        $this->rect($x0, $y - $hSchool, $tableW, $hSchool, 0.9);
        $this->text('I.P.E.T. Nº 50 "Ing.Emilio F. Olmos"', ($x0 + $x1) / 2, $y - $hSchool / 2 - 2.3, 9.2, true, 'center');
        $y -= $hSchool;

        // Fila: ALUMNOS / CAMPAÑA / AÑO.
        $this->rect($x0, $y - $hTop, $tableW, $hTop, 0.55);
        $split1 = $x0 + 0.44 * $tableW;
        $split2 = $x0 + 0.85 * $tableW;
        $this->line($split1, $y, $split1, $y - $hTop, 0.55);
        $this->line($split2, $y, $split2, $y - $hTop, 0.55);
        $this->text('ALUMNOS', ($x0 + $split1) / 2, $y - $hTop / 2 - 2.1, 7.7, true, 'center');
        $this->text($this->fit($campaniaNombre, 7.7, $split2 - $split1 - 4), ($split1 + $split2) / 2, $y - $hTop / 2 - 2.1, 7.7, true, 'center');
        $this->text(date('Y'), ($split2 + $x1) / 2, $y - $hTop / 2 - 2.1, 7.7, true, 'center');
        $y -= $hTop;

        // Fila curso + precio. Las divisiones verticales están alineadas con las columnas inferiores.
        $this->rect($x0, $y - $hCourse, $tableW, $hCourse, 0.55);
        $splitCourse = $xs[4];
        $splitPrice = $xs[6];
        $this->line($splitCourse, $y, $splitCourse, $y - $hCourse, 0.55);
        $this->line($splitPrice, $y, $splitPrice, $y - $hCourse, 0.55);
        $this->text('CURSO ' . $cursoCompleto, ($x0 + $splitCourse) / 2, $y - $hCourse / 2 - 2.0, 6.4, false, 'center');
        $precioFila = $precioGanTxt !== '' ? $precioVenTxt : $precioVenTxt;
        $this->text($precioFila, ($splitCourse + $splitPrice) / 2, $y - $hCourse / 2 - 2.0, 6.4, true, 'center');
        $y -= $hCourse;

        // Encabezado de columnas. CURSO y CANTIDADES quedan como rectángulos completos, sin línea cortando el texto.
        $this->rect($x0, $y - $hCols, $tableW, $hCols, 0.6);
        foreach ([$xs[1], $xs[2], $xs[4], $xs[6], $xs[7]] as $x) {
            $this->line($x, $y, $x, $y - $hCols, 0.55);
        }
        $this->line($xs[4], $y - $hCol1, $xs[6], $y - $hCol1, 0.55);
        $this->line($xs[5], $y - $hCol1, $xs[5], $y - $hCols, 0.55);

        $this->text('ORDEN', ($xs[0] + $xs[1]) / 2, $y - $hCols / 2 - 2.0, 6.1, true, 'center');
        $this->text('APELLIDO Y NOMBRES', ($xs[1] + $xs[2]) / 2, $y - $hCols / 2 - 2.0, 6.1, true, 'center');
        $this->text('CURSO', ($xs[2] + $xs[4]) / 2, $y - $hCol1 / 2 - 2.0, 6.1, true, 'center');
        $this->text('CANTIDADES', ($xs[4] + $xs[6]) / 2, $y - $hCol1 / 2 - 2.0, 6.1, true, 'center');
        $this->text('VEN', ($xs[4] + $xs[5]) / 2, $y - $hCol1 - $hCol2 / 2 - 2.0, 5.8, true, 'center');
        $this->text('GAN', ($xs[5] + $xs[6]) / 2, $y - $hCol1 - $hCol2 / 2 - 2.0, 5.8, true, 'center');
        $this->text('IMPORTE', ($xs[6] + $xs[7]) / 2, $y - $hCols / 2 + 1.2, 5.8, true, 'center');
        $this->text('COBRADO', ($xs[6] + $xs[7]) / 2, $y - $hCols / 2 - 5.1, 5.8, true, 'center');
        $this->text('OBSERVACIONES', ($xs[7] + $xs[8]) / 2, $y - $hCols / 2 - 2.0, 5.8, true, 'center');
        $y -= $hCols;

        $bottomReserved = 22 * $mm + 12 * $mm + 3 * $mm;
        $available = max(20.0, $y - $bottomReserved);
        $rowH = min(5.25 * $mm, max(4.35 * $mm, $available / max(1, $cantidad)));
        $fs = $rowH < 13 ? 5.4 : 5.8;

        foreach ($alumnos as $idx => $alumno) {
            $this->rect($x0, $y - $rowH, $tableW, $rowH, 0.45);
            foreach (array_slice($xs, 1, -1) as $x) {
                $this->line($x, $y, $x, $y - $rowH, 0.45);
            }
            $nombreAlumno = ventas_planillas_nombre_alumno($alumno);
            $this->text((string)($idx + 1), ($xs[0] + $xs[1]) / 2, $y - $rowH / 2 - 1.9, $fs, false, 'center');
            $this->text($this->fit($nombreAlumno, $fs, ($xs[2] - $xs[1]) - 4), $xs[1] + 3.0, $y - $rowH / 2 - 1.9, $fs, true, 'left');
            $this->text((string)$anioCurso, ($xs[2] + $xs[3]) / 2, $y - $rowH / 2 - 1.9, $fs, false, 'center');
            $this->text((string)$divisionCurso, ($xs[3] + $xs[4]) / 2, $y - $rowH / 2 - 1.9, $fs, false, 'center');
            $y -= $rowH;
        }

        // Borde inferior más marcado de la tabla principal.
        $this->line($x0, $y, $x1, $y, 1.05);

        // Totales.
        $gap = 2.5 * $mm;
        $totY = max(5.5 * $mm, $y - 14 * $mm);
        $totH = 11 * $mm;
        $boxW = ($tableW - 2 * $gap) / 3;
        $labels = ['TOTAL VEN: __________________', 'TOTAL GAN: __________________', 'TOTAL COBRADO: ______________'];
        for ($i = 0; $i < 3; $i++) {
            $bx = $x0 + $i * ($boxW + $gap);
            $this->rect($bx, $totY, $boxW, $totH, 0.55);
            $this->text($labels[$i], $bx + 3.0, $totY + $totH / 2 - 2.0, 6.0, true, 'left');
        }
    }

    private function addPage(): void
    {
        if ($this->cmd) $this->pages[] = implode("\n", $this->cmd);
        $this->cmd = [];
        $this->cmd[] = '0 0 0 RG';
        $this->cmd[] = '0 0 0 rg';
    }

    private function line(float $x1, float $y1, float $x2, float $y2, float $w = 0.5): void
    {
        $this->cmd[] = sprintf('%.3F w %.3F %.3F m %.3F %.3F l S', $w, $x1, $y1, $x2, $y2);
    }

    private function rect(float $x, float $y, float $w, float $h, float $lw = 0.5): void
    {
        $this->cmd[] = sprintf('%.3F w %.3F %.3F %.3F %.3F re S', $lw, $x, $y, $w, $h);
    }

    private function text(string $txt, float $x, float $y, float $size = 7, bool $bold = false, string $align = 'left'): void
    {
        $txt = $this->toWinAnsi($txt);
        $width = $this->textWidth($txt, $size, $bold);
        if ($align === 'center') $x -= $width / 2;
        if ($align === 'right') $x -= $width;
        $font = $bold ? 'F2' : 'F1';
        $this->cmd[] = sprintf('BT /%s %.3F Tf 1 0 0 1 %.3F %.3F Tm (%s) Tj ET', $font, $size, $x, $y, $this->escape($txt));
    }

    private function fit(string $txt, float $size, float $maxWidth): string
    {
        $txt = trim(preg_replace('/\s+/u', ' ', $txt) ?? $txt);
        if ($this->textWidth($this->toWinAnsi($txt), $size, false) <= $maxWidth) return $txt;
        while (ventas_planillas_strlen($txt) > 1 && $this->textWidth($this->toWinAnsi($txt), $size, false) > $maxWidth) {
            $txt = ventas_planillas_substr($txt, 0, ventas_planillas_strlen($txt) - 1);
        }
        return rtrim($txt);
    }

    private function textWidth(string $txt, float $size, bool $bold = false): float
    {
        // Aproximación visual para Helvetica/Calibri-like.
        $len = strlen($txt);
        return $len * $size * ($bold ? 0.49 : 0.47);
    }

    private function toWinAnsi(string $txt): string
    {
        $converted = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $txt);
        if ($converted === false) {
            $converted = preg_replace('/[^\x20-\x7E]/', '', $txt) ?? '';
        }
        return $converted;
    }

    private function escape(string $txt): string
    {
        return str_replace(['\\', '(', ')', "\r", "\n"], ['\\\\', '\\(', '\\)', ' ', ' '], $txt);
    }

    public function output(): string
    {
        if ($this->cmd) {
            $this->pages[] = implode("\n", $this->cmd);
            $this->cmd = [];
        }

        $objects = [];
        $pageRefs = [];
        $countPages = count($this->pages);

        $objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        $objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        $objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

        foreach ($this->pages as $i => $stream) {
            $pageObj = 5 + $i * 2;
            $contentObj = $pageObj + 1;
            $pageRefs[] = $pageObj . ' 0 R';
            $objects[$pageObj] = sprintf(
                '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.3F %.3F] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents %d 0 R >>',
                self::W,
                self::H,
                $contentObj
            );
            $objects[$contentObj] = "<< /Length " . strlen($stream) . " >>\nstream\n" . $stream . "\nendstream";
        }

        $objects[2] = '<< /Type /Pages /Count ' . $countPages . ' /Kids [ ' . implode(' ', $pageRefs) . ' ] >>';
        ksort($objects);

        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [0 => '0000000000 65535 f '];
        foreach ($objects as $id => $body) {
            $offsets[$id] = sprintf('%010d 00000 n ', strlen($pdf));
            $pdf .= $id . " 0 obj\n" . $body . "\nendobj\n";
        }

        $xrefPos = strlen($pdf);
        $maxId = max(array_keys($objects));
        $pdf .= "xref\n0 " . ($maxId + 1) . "\n";
        for ($i = 0; $i <= $maxId; $i++) {
            $pdf .= ($offsets[$i] ?? sprintf('%010d 00000 f ', 0)) . "\n";
        }
        $pdf .= "trailer\n<< /Size " . ($maxId + 1) . " /Root 1 0 R >>\nstartxref\n" . $xrefPos . "\n%%EOF";
        return $pdf;
    }
}

function ventas_planillas_render_cursos($campania, $grupos, $productoGan, $soloActivos, string $numeroBot = VENTAS_PLANILLAS_NUMERO_BOT_DEFAULT) {
    $campaniaNombre = trim((string)($campania['nombre'] ?? 'Venta escolar')) ?: 'Venta escolar';
    $totalCursos = count($grupos);

    if ($totalCursos <= 0) {
        throw new RuntimeException('No se encontraron alumnos para generar planillas.');
    }

    $pdf = new VentasPlanillasPdfVertical();
    foreach ($grupos as $grupo) {
        $pdf->drawCourseSheet($grupo, $campania, $productoGan, $numeroBot);
    }

    $filename = 'planillas_' . ventas_planillas_slug($campaniaNombre) . '_vertical.pdf';
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="' . $filename . '"');
    header('Cache-Control: private, max-age=0, must-revalidate');
    echo $pdf->output();
    exit;
}

try {
    $pdo = ventas_pdo();
    ventas_tablas_verificadas($pdo);
    $action = (string)($_GET['action'] ?? 'ventas_planillas_cursos');

    if ($action === 'ventas_planillas_cursos') {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
            ventas_json(['exito' => false, 'mensaje' => 'Método no permitido.'], 405);
        }

        $idCampania = isset($_GET['id_campania']) ? (int)$_GET['id_campania'] : 0;
        $soloActivos = isset($_GET['solo_activos']) ? ventas_bool($_GET['solo_activos'], 1) === 1 : true;
        $idAnio = isset($_GET['id_anio']) ? (int)$_GET['id_anio'] : 0;
        $idDivision = isset($_GET['id_division']) ? (int)$_GET['id_division'] : 0;
        $numeroBot = trim((string)($_GET['numero_bot'] ?? VENTAS_PLANILLAS_NUMERO_BOT_DEFAULT));
        $numeroBot = preg_replace('/[^0-9+()\s.-]/', '', $numeroBot) ?: VENTAS_PLANILLAS_NUMERO_BOT_DEFAULT;

        $campania = ventas_planillas_obtener_campania($pdo, $idCampania);
        $productoGan = ventas_planillas_producto_gan($pdo, isset($campania['id_producto_principal']) ? (int)$campania['id_producto_principal'] : null);
        $alumnos = ventas_planillas_obtener_alumnos($pdo, $soloActivos, $idAnio, $idDivision);
        $grupos = ventas_planillas_agrupar_por_curso($alumnos);

        ventas_planillas_render_cursos($campania, $grupos, $productoGan, $soloActivos, $numeroBot);
    }

    ventas_json(['exito' => false, 'mensaje' => 'Acción de planillas no válida.'], 404);
} catch (Throwable $e) {
    // Si el endpoint fue invocado desde window.open, devolvemos HTML legible para que no quede pantalla en blanco.
    if (!headers_sent()) {
        header('Content-Type: text/html; charset=utf-8');
        http_response_code(200);
    }
    echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Error planillas</title>';
    echo '<style>body{font-family:Arial,sans-serif;background:#f8fafc;color:#111827;padding:32px}.box{max-width:720px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:24px;box-shadow:0 18px 38px rgba(15,23,42,.12)}h1{color:#b91c1c;margin-top:0}button{border:0;background:#1d428a;color:#fff;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer}</style>';
    echo '</head><body><div class="box"><h1>No se pudieron generar las planillas</h1><p>' . ventas_planillas_h($e->getMessage()) . '</p><button onclick="window.close()">Cerrar</button></div></body></html>';
    exit;
}
