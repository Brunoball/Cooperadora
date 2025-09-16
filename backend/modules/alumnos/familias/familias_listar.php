<?php
declare(strict_types=1);

require_once __DIR__ . '/_common.php';

$pdo = fam_pdo();

try {
    $sql = "
        SELECT
            f.id_familia,
            f.nombre_familia,
            f.observaciones,
            f.activo,
            DATE(f.creado_en)       AS creado_en,
            DATE(f.actualizado_en)  AS actualizado_en,
            DATE_FORMAT(f.creado_en, '%d/%m/%Y') AS fecha_alta,

            /* Contadores con ALUMNOS */
            (SELECT COUNT(*) FROM alumnos a WHERE a.id_familia = f.id_familia AND a.activo = 1) AS miembros_activos,
            (SELECT COUNT(*) FROM alumnos a WHERE a.id_familia = f.id_familia)                  AS miembros_totales
        FROM familias f
        ORDER BY f.nombre_familia ASC
    ";

    $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

    fam_json(['exito' => true, 'familias' => $rows]);
} catch (Throwable $e) {
    fam_json(['exito' => false, 'mensaje' => 'Error al listar familias', 'error' => $e->getMessage()], 500);
}
