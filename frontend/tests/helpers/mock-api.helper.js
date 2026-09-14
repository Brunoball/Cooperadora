const DEFAULT_LISTAS = {
  anios: [{ id: 1, nombre: '1°' }],
  divisiones: [{ id: 1, nombre: 'A' }],
  categorias: [{ id: 1, nombre: 'EXTERNO', monto_mensual: 10000, monto_anual: 90000 }],
  categorias_monto: [{ id: 1, nombre: 'EXTERNO', monto_mensual: 10000, monto_anual: 90000 }],
  meses: [
    { id: 3, nombre: 'MARZO' }, { id: 4, nombre: 'ABRIL' }, { id: 5, nombre: 'MAYO' },
    { id: 6, nombre: 'JUNIO' }, { id: 7, nombre: 'JULIO' }, { id: 8, nombre: 'AGOSTO' },
    { id: 9, nombre: 'SEPTIEMBRE' }, { id: 10, nombre: 'OCTUBRE' }, { id: 11, nombre: 'NOVIEMBRE' },
    { id: 12, nombre: 'DICIEMBRE' }, { id: 13, nombre: 'CONTADO ANUAL' }, { id: 14, nombre: 'MATRICULA' },
    { id: 15, nombre: '1ER MITAD' }, { id: 16, nombre: '2DA MITAD' },
  ],
  sexos: [{ id: 1, sexo: 'F' }, { id: 2, sexo: 'M' }],
  tipos_documentos: [{ id: 1, descripcion: 'DNI', sigla: 'DNI' }],
  medios_pago: [{ id: 1, nombre: 'EFECTIVO' }, { id: 2, nombre: 'TRANSFERENCIA' }],
  contable_categorias: [{ id: 1, nombre: 'CUOTAS' }],
  contable_descripciones: [{ id: 1, nombre: 'INGRESO TEST' }],
  contable_proveedores: [{ id: 1, nombre: 'PROVEEDOR TEST' }],
  egreso_categorias: [{ id: 1, nombre: 'CUOTAS' }],
  egreso_descripciones: [{ id: 1, nombre: 'INGRESO TEST' }],
  proveedores: [{ id: 1, nombre: 'PROVEEDOR TEST' }],
  egreso_proveedores: [{ id: 1, nombre: 'PROVEEDOR TEST' }],
};

const DEFAULTS = {
  obtener_listas: { exito: true, listas: DEFAULT_LISTAS },
  cuotas: { exito: true, cuotas: [] },
  meses_pagados: { exito: true, meses: [], pagos: [] },
  obtener_monto_matricula: { exito: true, monto: 25000 },
  matricula: { exito: true, monto: 25000 },
  obtener_info_familia: { exito: true, tiene_familia: false, miembros_total: 0, miembros_activos: 0, miembros: [] },
  obtener_monto_categoria: {
    exito: true, id_alumno: 101, id_cat_monto: 1, categoria_nombre: 'EXTERNO', anio: 2026,
    family_count: 1, base_monto_mensual: 10000, base_monto_anual: 90000,
    monto_mensual: 10000, monto_anual: 90000,
    montos_por_periodo: { 3: 10000, 4: 10000, 5: 10000, 6: 10000, 7: 10000, 8: 10000, 9: 10000, 10: 10000, 11: 10000, 12: 10000 },
    override_aplicado: false, id_cat_hermanos: 0, warning: null,
  },
  cat_listar: [
    { id: 1, descripcion: 'EXTERNO', monto: 10000, monto_anual: 90000, fecha_creacion: '2026-03-01' },
  ],
  cat_hermanos_listar: { exito: true, items: [] },
  cat_historial: { exito: true, historial: [] },
  cat_hermanos_historial: { exito: true, historial: [] },
  td_listar: { exito: true, tipos_documentos: [{ id_tipo_documento: 1, descripcion: 'Documento Nacional de Identidad', sigla: 'DNI' }] },
  familias_listar: { exito: true, familias: [] },
  familia_miembros: { exito: true, miembros: [] },
  alumnos_sin_familia: { exito: true, alumnos: [] },
  socios_sin_familia: { exito: true, alumnos: [] },
  alumnos: { exito: true, alumnos: [] },
  alumnos_baja: { exito: true, alumnos: [] },
  contable: { exito: true, datos: [] },
  contable_ingresos: { exito: true, datos: [], anios_disponibles: [2026], total: 0 },
  ingresos_list: { exito: true, datos: [], ingresos: [] },
  contable_egresos: { exito: true, datos: [], anios_disponibles: [2026] },
  contable_resumen: { exito: true, resumen: [], ingresos: 0, egresos: 0, saldo: 0 },
  meses_list: { exito: true, meses: DEFAULT_LISTAS.meses },
  ventas_dashboard: { exito: true, resumen: { campanias_total: 0, campanias_activas: 0, productos_activos: 0, ordenes_aprobadas: 0, total_aprobado: 0 } },
  ventas_campanias: { exito: true, items: [] },
  ventas_productos: { exito: true, items: [] },
  ventas_ordenes: { exito: true, items: [], total: 0 },
  ventas_medios_pago: { exito: true, items: [{ id_medio_pago: 1, medio_pago: 'EFECTIVO' }] },
  ventas_personas_catalogo: { exito: true, alumnos: [], personas: [] },
  ventas_planillas_opciones: { exito: true, anios: [{ id_anio: 1, nombre: '1°' }], divisiones: [{ id_division: 1, nombre: 'A' }], total_docentes: 0 },
  ventas_planillas_cursos: { exito: true, items: [] },
  ventas_menu_activo: { exito: true, mostrar_opcion_menu: true, campanias: [] },
};

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

async function parseRequestData(request) {
  const contentType = (await request.allHeaders())['content-type'] || '';
  const raw = request.postData() || '';
  if (!raw) return null;
  if (contentType.includes('application/json')) {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw).entries());
  }
  return raw;
}

/**
 * Deterministic API mock for UI-only tests. `handlers[action]` may be:
 * - object/array: JSON response
 * - function({request,url,action,calls,data}) => response object or {status, body}
 */
async function installApiMock(page, handlers = {}, { strict = false } = {}) {
  const calls = [];
  await page.route('**/api.php?*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const action = url.searchParams.get('action') || '';
    const data = await parseRequestData(request);
    const call = { action, method: request.method(), url: url.href, params: Object.fromEntries(url.searchParams.entries()), data, raw: request.postData() || '' };
    calls.push(call);

    let handler = Object.prototype.hasOwnProperty.call(handlers, action) ? handlers[action] : DEFAULTS[action];
    if (handler === undefined) {
      if (strict) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ exito: false, mensaje: `Mock faltante: ${action}` }) });
      }
      return route.fallback();
    }

    let result = typeof handler === 'function' ? await handler({ request, url, action, calls, data }) : clone(handler);
    let status = 200;
    let body = result;
    let contentType = 'application/json; charset=utf-8';
    let raw = false;
    if (result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'body') && Object.prototype.hasOwnProperty.call(result, 'status')) {
      status = result.status;
      body = result.body;
      contentType = result.contentType || contentType;
      raw = Boolean(result.raw) || !contentType.toLowerCase().includes('json');
    }
    if (raw) {
      const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''));
      return route.fulfill({ status, contentType, headers: { 'x-e2e-mock': '1' }, body: payload });
    }
    return route.fulfill({ status, contentType, headers: { 'x-e2e-mock': '1' }, body: JSON.stringify(body ?? {}) });
  });
  return {
    calls,
    byAction(action) { return calls.filter(c => c.action === action); },
    last(action) { return [...calls].reverse().find(c => c.action === action); },
  };
}

module.exports = { DEFAULT_LISTAS, DEFAULTS, installApiMock };
