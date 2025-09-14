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

$M = realpath(__DIR__ . '/../modules');
if ($M === false) {
    http_response_code(200);
    echo json_encode(['exito' => false, 'mensaje' => 'No se encontró la carpeta de módulos.']);
    exit;
}

function include_module($path) {
    if (!is_file($path)) {
        http_response_code(200);
        echo json_encode([
            'exito' => false,
            'mensaje' => 'Ruta no encontrada',
            'ruta_buscada' => $path
        ]);
        return false;
    }
    require $path;
    return true;
}

try {
    switch ($action) {
        /* ===========================
           LOGIN / REGISTRO
        ============================ */
        case 'inicio':             include_module($M . '/login/inicio.php'); break;
        case 'registro':           include_module($M . '/login/registro.php'); break;

        /* ===========================
           ALUMNOS
        ============================ */
        case 'alumnos':            include_module($M . '/alumnos/obtener_alumnos.php'); break;
        case 'alumnos_baja':       include_module($M . '/alumnos/alumnos_baja.php'); break;
        case 'agregar_alumno':     include_module($M . '/alumnos/agregar_alumno.php'); break;
        case 'editar_alumno':      include_module($M . '/alumnos/editar_alumno.php'); break;
        case 'eliminar_alumno':    include_module($M . '/alumnos/eliminar_alumno.php'); break;
        case 'dar_baja_alumno':    include_module($M . '/alumnos/dar_baja_alumno.php'); break;
        case 'dar_alta_alumno':    include_module($M . '/alumnos/dar_alta_alumno.php'); break;
        case 'eliminar_bajas':     include_module($M . '/alumnos/eliminar_bajas.php'); break;

        /* ===========================
           GLOBAL
        ============================ */
        case 'obtener_listas':     include_module($M . '/global/obtener_listas.php'); break;

        /* ===========================
           CUOTAS
        ============================ */
        case 'cuotas':             include_module($M . '/cuotas/cuotas.php'); break;
        case 'meses_pagados':      include_module($M . '/cuotas/meses_pagados.php'); break;
        case 'registrar_pago':     include_module($M . '/cuotas/registrar_pago.php'); break;
        case 'eliminar_pago':      include_module($M . '/cuotas/eliminar_pago.php'); break;

        /* ✅ NUEVO: ficha para impresión de comprobante */
        case 'obtener_socio_comprobante':
        case 'socio_comprobante':  // alias opcional por compatibilidad
            include_module($M . '/cuotas/obtener_socio_comprobante.php');
            break;

        /* ===========================
           CONTABLE (LEGADO)
        ============================ */
        case 'contable':           include_module($M . '/contable/contable_socios.php'); break;

        /* ===========================
           ✅ CONTABLE NUEVO
           - Ingresos (desde pagos + categoría)
           - Egresos (ABM, resumen)
        ============================ */
        case 'contable_ingresos':       include_module($M . '/contable/ingresos.php');  break;
        case 'contable_egresos':        include_module($M . '/contable/egresos.php');   break;
        case 'contable_egresos_upload': include_module($M . '/contable/contable_egresos_upload.php'); break;
        case 'medio_pago_crear':   include_module($M . '/contable/medio_pago_crear.php'); break;

        /* ===========================
           TIPOS DE DOCUMENTOS
        ============================ */
        case 'td_listar':          include_module($M . '/tipos_documentos/listar_documentos.php'); break;
        case 'td_crear':           include_module($M . '/tipos_documentos/crear_documentos.php');  break;
        case 'td_actualizar':      include_module($M . '/tipos_documentos/editar_documentos.php'); break;
        case 'td_eliminar':        include_module($M . '/tipos_documentos/eliminar_documentos.php'); break;

        /* ===========================
           ✅ CATEGORÍAS
        ============================ */
        case 'cat_listar':         include_module($M . '/categorias/obtener_categorias.php'); break;
        case 'cat_crear':          include_module($M . '/categorias/agregar_categoria.php');   break;
        case 'cat_actualizar':     include_module($M . '/categorias/editar_categoria.php');    break; // solo monto
        case 'cat_eliminar':       include_module($M . '/categorias/eliminar_categoria.php');  break;
        case 'cat_historial':      include_module($M . '/categorias/obtener_historial.php');   break;

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
