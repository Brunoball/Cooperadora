<?php
// backend/routes/api.php

// --- CORS ---
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header("Vary: Origin");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

date_default_timezone_set('America/Argentina/Cordoba');
mb_internal_encoding('UTF-8');

$action = $_GET['action'] ?? '';

/**
 * Carga un módulo con el formato requerido y corta la ejecución.
 * Si el archivo no existe, responde JSON con error y corta.
 */
function load_and_exit(string $relativePath): void
{
    $path = __DIR__ . '/../modules/' . ltrim($relativePath, '/');

    if (!is_file($path)) {
        http_response_code(200);
        echo json_encode([
            'exito' => false,
            'mensaje' => 'Ruta no encontrada',
            'ruta_buscada' => $relativePath
        ]);
        exit;
    }

    require_once $path;
    exit;
}

try {
    switch ($action) {
        /* ===========================
           LOGIN / REGISTRO
        ============================ */
        case 'inicio':
            require_once __DIR__ . '/../modules/login/inicio.php';
            exit;

        case 'registro':
            require_once __DIR__ . '/../modules/login/registro.php';
            exit;

        /* ===========================
           ALUMNOS
        ============================ */
        case 'alumnos':
            require_once __DIR__ . '/../modules/alumnos/obtener_alumnos.php';
            exit;

        case 'alumnos_baja':
            require_once __DIR__ . '/../modules/alumnos/alumnos_baja.php';
            exit;

        case 'agregar_alumno':
            require_once __DIR__ . '/../modules/alumnos/agregar_alumno.php';
            exit;

        case 'editar_alumno':
            require_once __DIR__ . '/../modules/alumnos/editar_alumno.php';
            exit;

        case 'eliminar_alumno':
            require_once __DIR__ . '/../modules/alumnos/eliminar_alumno.php';
            exit;

        case 'dar_baja_alumno':
            require_once __DIR__ . '/../modules/alumnos/dar_baja_alumno.php';
            exit;

        case 'dar_alta_alumno':
            require_once __DIR__ . '/../modules/alumnos/dar_alta_alumno.php';
            exit;

        case 'eliminar_bajas':
            require_once __DIR__ . '/../modules/alumnos/eliminar_bajas.php';
            exit;

        /* =========================
           FAMILIAS (usa ALUMNOS)
        ========================= */
        case 'familias_listar':
            require_once __DIR__ . '/../modules/alumnos/familias/familias_listar.php';
            exit;

        case 'familia_agregar':
            require_once __DIR__ . '/../modules/alumnos/familias/agregar_familia.php';
            exit;

        case 'familia_editar':
            require_once __DIR__ . '/../modules/alumnos/familias/editar_familia.php';
            exit;

        case 'familia_eliminar':
            require_once __DIR__ . '/../modules/alumnos/familias/eliminar_familia.php';
            exit;

        case 'familia_miembros':
            require_once __DIR__ . '/../modules/alumnos/familias/familia_miembros.php';
            exit;

        case 'alumnos_sin_familia':
            require_once __DIR__ . '/../modules/alumnos/familias/alumnos_sin_familia.php';
            exit;

        case 'socios_sin_familia':
            require_once __DIR__ . '/../modules/alumnos/familias/alumnos_sin_familia.php';
            exit;

        case 'familia_agregar_miembros':
            require_once __DIR__ . '/../modules/alumnos/familias/familia_agregar_miembros.php';
            exit;

        case 'familia_quitar_miembro':
            require_once __DIR__ . '/../modules/alumnos/familias/familia_quitar_miembro.php';
            exit;

        case 'familia_guardar':
            require_once __DIR__ . '/../modules/alumnos/familias/familia_guardar.php';
            exit;

        /* ===========================
           GLOBAL
        ============================ */
        case 'obtener_listas':
            require_once __DIR__ . '/../modules/global/obtener_listas.php';
            exit;

        /* ===========================
           CUOTAS
        ============================ */
        case 'cuotas':
            require_once __DIR__ . '/../modules/cuotas/cuotas.php';
            exit;

        case 'meses_pagados':
            require_once __DIR__ . '/../modules/cuotas/meses_pagados.php';
            exit;

        case 'registrar_pago':
            require_once __DIR__ . '/../modules/cuotas/registrar_pago.php';
            exit;

        case 'eliminar_pago':
            require_once __DIR__ . '/../modules/cuotas/eliminar_pago.php';
            exit;

        /* ✅ NUEVO: ficha para impresión de comprobante */
        case 'obtener_socio_comprobante':
        case 'socio_comprobante':
            require_once __DIR__ . '/../modules/cuotas/obtener_socio_comprobante.php';
            exit;

        /* ✅ MONTOS por categoría del alumno (incluye monto_matricula) */
        case 'obtener_monto_categoria':
            require_once __DIR__ . '/../modules/cuotas/obtener_monto_categoria.php';
            exit;

        /* ✅ MATRÍCULA (único endpoint GET/POST) */
        case 'matricula':                     // GET -> obtener; POST -> actualizar
        case 'obtener_monto_matricula':       // alias GET
        case 'actualizar_monto_matricula':    // alias POST
            require_once __DIR__ . '/../modules/cuotas/matricula.php';
            exit;

        /* ===========================
           CONTABLE (LEGADO)
        ============================ */
        case 'contable':
            require_once __DIR__ . '/../modules/contable/contable_socios.php';
            exit;

        /* ===========================
           ✅ CONTABLE NUEVO
        ============================ */
        case 'contable_ingresos':
            require_once __DIR__ . '/../modules/contable/ingresos.php';
            exit;

        case 'contable_egresos':
            require_once __DIR__ . '/../modules/contable/egresos.php';
            exit;

        case 'contable_egresos_upload':
            require_once __DIR__ . '/../modules/contable/contable_egresos_upload.php';
            exit;

        case 'medio_pago_crear':
            require_once __DIR__ . '/../modules/contable/medio_pago_crear.php';
            exit;

        case 'contable_resumen':
            require_once __DIR__ . '/../modules/contable/resumen.php';
            exit;

        case 'ingresos_list':
        case 'ingresos_create':
        case 'ingresos':
            require_once __DIR__ . '/../modules/contable/agregar_ingresos.php';
            exit;

        case 'editar_ingresos':
            require_once __DIR__ . '/../modules/contable/editar_ingresos.php';
            exit;

        case 'eliminar_ingresos':
            require_once __DIR__ . '/../modules/contable/eliminar_ingresos.php';
            exit;

        case 'agregar_categoria':
            require_once __DIR__ . '/../modules/contable/agregar_categoria.php';
            exit;

        case 'agregar_descripcion':
            require_once __DIR__ . '/../modules/contable/agregar_descripcion.php';
            exit;

        case 'agregar_proveedor':
            require_once __DIR__ . '/../modules/contable/agregar_proveedor.php';
            exit;


        /* ===========================
           TIPOS DE DOCUMENTOS
        ============================ */
        case 'td_listar':
            require_once __DIR__ . '/../modules/tipos_documentos/listar_documentos.php';
            exit;

        case 'td_crear':
            require_once __DIR__ . '/../modules/tipos_documentos/crear_documentos.php';
            exit;

        case 'td_actualizar':
            require_once __DIR__ . '/../modules/tipos_documentos/editar_documentos.php';
            exit;

        case 'td_eliminar':
            require_once __DIR__ . '/../modules/tipos_documentos/eliminar_documentos.php';
            exit;

        /* ===========================
           ✅ CATEGORÍAS
        ============================ */
        case 'cat_listar':
            require_once __DIR__ . '/../modules/categorias/obtener_categorias.php';
            exit;

        case 'cat_crear':
            require_once __DIR__ . '/../modules/categorias/agregar_categoria.php';
            exit;

        case 'cat_actualizar':
            require_once __DIR__ . '/../modules/categorias/editar_categoria.php';
            exit;

        case 'cat_eliminar':
            require_once __DIR__ . '/../modules/categorias/eliminar_categoria.php';
            exit;

        case 'cat_historial':
            require_once __DIR__ . '/../modules/categorias/obtener_historial.php';
            exit;

        /* ===========================
           DEFAULT
        ============================ */
        default:
            http_response_code(200);
            echo json_encode(['exito' => false, 'mensaje' => 'Acción no válida: ' . $action]);
            break;
    }
} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode(['exito' => false, 'mensaje' => 'Error en router: ' . $e->getMessage()]);
}
