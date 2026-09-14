const { loadTestEnv } = require('./env.helper');
const READ_ACTIONS = new Set([
  // Global / alumnos / familias
  'obtener_listas', 'alumnos', 'alumnos_baja', 'editar_alumno',
  'familias_listar', 'familia_miembros', 'alumnos_sin_familia', 'socios_sin_familia',

  // Categorías / documentos
  'cat_listar', 'cat_hermanos_listar', 'cat_historial', 'cat_hermanos_historial', 'td_listar',

  // Cuotas
  'cuotas', 'meses_pagados', 'matricula', 'obtener_monto_matricula', 'buscar_pago_eliminar',
  'obtener_monto_categoria', 'obtener_info_familia', 'obtener_socio_comprobante',

  // Contable
  'contable', 'contable_ingresos', 'contable_egresos', 'contable_resumen', 'meses_list', 'ingresos_list',

  // Ventas
  'ventas_dashboard', 'ventas_campanias', 'ventas_productos', 'ventas_ordenes', 'ventas_orden_detalle',
  'ventas_medios_pago', 'ventas_personas_catalogo', 'ventas_planillas_opciones', 'ventas_planillas_cursos',
  'ventas_menu_activo',
]);
function allowedRequest(action, method, params) {
  if (method === 'OPTIONS') return true;
  if (action === 'inicio') return method === 'POST' || method === 'GET';
  // Lookup read-only implementado como POST en el backend actual.
  if (action === 'buscar_pago_eliminar') return method === 'POST';
  if (method !== 'GET' || !READ_ACTIONS.has(action)) return false;
  const op = params.get('op');
  if (op && !['list', 'list_years', 'get'].includes(op)) return false;
  return true;
}
function actionUrl(action, params = {}) {
  const url = new URL(`${loadTestEnv().apiBase}/api.php`);
  url.searchParams.set('action', action);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url.href;
}
async function parseResponse(response) {
  const raw = await response.text();
  try { return JSON.parse(raw); }
  catch { throw new Error(`Respuesta no JSON, HTTP ${response.status()}. Revisá URL de API y salida de PHP.`); }
}
async function apiResult(request, action, { method = 'GET', params = {}, data } = {}) {
  const url = actionUrl(action, params);
  if (!allowedRequest(action, method, new URL(url).searchParams)) throw new Error(`Operación fuera de la suite de consultas: ${method} ${action}`);
  const response = await request.fetch(url, {
    method, ...(data !== undefined ? { data } : {}), timeout: 45000,
    maxRedirects: 0, failOnStatusCode: false,
  });
  return { status: response.status(), ok: response.ok(), body: await parseResponse(response) };
}
async function apiCall(request, action, options) {
  const result = await apiResult(request, action, options);
  if (!result.ok || result.body?.exito === false || result.body?.error) {
    throw new Error(`${action}: HTTP ${result.status}. ${result.body?.mensaje || 'Respuesta de error de la API.'}`);
  }
  return result.body;
}
async function createApiSession(request, username, password) {
  const body = await apiCall(request, 'inicio', { method: 'POST', data: { nombre: username, contrasena: password } });
  if (!body.usuario || !Number(body.usuario.idUsuario)) throw new Error('El login no devolvió un usuario de Cooperadora válido.');
  return body;
}
module.exports = { READ_ACTIONS, allowedRequest, actionUrl, parseResponse, apiResult, apiCall, createApiSession };
