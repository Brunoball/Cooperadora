<?php
declare(strict_types=1);

// backend/modules/contable/route.php

function route_contable(string $action): bool
{
  switch ($action) {
    case 'contable':
      require __DIR__ . '/contable_socios.php';
      return true;

    case 'contable_ingresos':
      require __DIR__ . '/ingresos.php';
      return true;

    case 'contable_egresos':
      require __DIR__ . '/egresos.php';
      return true;

    case 'contable_egresos_upload':
      require __DIR__ . '/contable_egresos_upload.php';
      return true;

    case 'medio_pago_crear':
      require __DIR__ . '/medio_pago_crear.php';
      return true;

    case 'contable_resumen':
      require __DIR__ . '/resumen.php';
      return true;

    case 'ingresos_list':
    case 'ingresos_create':
    case 'ingresos':
      require __DIR__ . '/agregar_ingresos.php';
      return true;

    case 'editar_ingresos':
      require __DIR__ . '/editar_ingresos.php';
      return true;

    case 'eliminar_ingresos':
      require __DIR__ . '/eliminar_ingresos.php';
      return true;

    case 'agregar_categoria':
      require __DIR__ . '/agregar_categoria.php';
      return true;

    case 'agregar_descripcion':
      require __DIR__ . '/agregar_descripcion.php';
      return true;

    case 'agregar_proveedor':
      require __DIR__ . '/agregar_proveedor.php';
      return true;

    /* ✅ NUEVO: endpoint que te está faltando */
    case 'meses_list':
      $file = __DIR__ . '/meses_list.php';
      if (!is_file($file)) {
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
          'exito' => false,
          'mensaje' => 'Falta implementar backend/modules/contable/meses_list.php',
        ], JSON_UNESCAPED_UNICODE);
        exit;
      }
      require $file;
      return true;
  }

  return false;
}