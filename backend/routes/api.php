<?php
// routes/api.php

// --- CORS (robusto para dev y prod) ---
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header("Vary: Origin");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Max-Age: 86400");
header("Content-Type: application/json; charset=utf-8");

// Preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

// --- Zona horaria y encoding ---
date_default_timezone_set('America/Argentina/Cordoba');
mb_internal_encoding('UTF-8');

// --- Acción solicitada ---
$action = $_GET['action'] ?? '';

// --- Base de rutas segura ---
$M = realpath(__DIR__ . '/../modules');
if ($M === false) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'No se encontró la carpeta de módulos.']);
    exit;
}

// Helper para incluir archivos con verificación
function include_module($path) {
    if (!is_file($path)) {
        http_response_code(404);
        echo json_encode(['exito' => false, 'mensaje' => 'Ruta no encontrada: ' . basename($path)]);
        return false;
    }
    require_once $path;
    return true;
}

// --- Router ---
switch ($action) {
    /* LOGIN / REGISTRO */
    case 'inicio':
        include_module($M . '/login/inicio.php');
        break;

    case 'registro':
        include_module($M . '/login/registro.php');
        break;

    /* ALUMNOS */
    case 'alumnos': // GET: lista de alumnos activos (activo = 1)
        include_module($M . '/alumnos/obtener_alumnos.php');
        break;

    case 'alumnos_baja': // GET: lista de alumnos dados de baja (activo = 0)
        include_module($M . '/alumnos/alumnos_baja.php');
        break;

    case 'agregar_alumno': // POST: crear alumno
        include_module($M . '/alumnos/agregar_alumno.php');
        break;

    case 'editar_alumno': // GET: trae | POST: actualiza (lo maneja el módulo)
        include_module($M . '/alumnos/editar_alumno.php');
        break;

    case 'eliminar_alumno': // POST: baja lógica/física (según módulo)
        include_module($M . '/alumnos/eliminar_alumno.php');
        break;

    case 'dar_baja_alumno': // POST: { id_alumno, motivo } -> activo=0, guarda motivo, opcional ingreso=CURDATE()
        include_module($M . '/alumnos/dar_baja_alumno.php');
        break;

    case 'dar_alta_alumno': // POST: { id_alumno } -> activo=1 (opcional: limpiar motivo)
        include_module($M . '/alumnos/dar_alta_alumno.php');
        break;

    case 'eliminar_bajas': // POST: { id_alumno } o { ids:[] } -> borra SOLO inactivos
        include_module($M . '/alumnos/eliminar_bajas.php');
        break;

    /* GLOBAL */
    case 'obtener_listas':
        include_module($M . '/global/obtener_listas.php');
        break;

    /* CUOTAS (ALUMNOS) */
    case 'cuotas': // GET: lista de cuotas (pagados/deudores) segun pagos y mes/año actual
        include_module($M . '/cuotas/cuotas.php');
        break;

    case 'periodos_pagados':
        require_once("$M/cuotas/periodos_pagados.php");
        break;

    case 'registrar_pago':
        require_once("$M/cuotas/registrar_pago.php");
        break;

    default:
        http_response_code(400);
        echo json_encode(['exito' => false, 'mensaje' => 'Acción no válida.']);
        break;
}
