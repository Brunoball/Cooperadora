<?php
// backend/modules/alumnos/familias/familias_exportar_excel.php
// Por ahora devolvemos JSON para que el frontend use el fallback local (XLSX en el navegador).

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

echo json_encode([
  'exito' => false,
  'mensaje' => 'Exportación XLSX no implementada en backend. El frontend generará el Excel localmente (fallback).'
], JSON_UNESCAPED_UNICODE);
