const { test, expect } = require('@playwright/test');
const { apiCall } = require('./helpers/api.helper');
const contracts = [
  ['alumnos', 'alumnos'], ['alumnos_baja', 'alumnos'], ['familias_listar', 'familias'],
  ['cat_listar', null], ['td_listar', 'tipos_documentos'], ['cuotas', 'cuotas'],
  ['cuotas', 'anios', { listar_anios: 1 }], ['meses_list', 'meses'],
  ['contable', 'datos'], ['contable_egresos', 'datos', { op: 'list' }],
  ['contable_egresos', 'anios_disponibles', { op: 'list_years' }],
  ['contable_ingresos', 'anios_disponibles', { meta: 1 }],
  ['contable_resumen', 'resumen'],
  ['ventas_campanias', 'items'], ['ventas_productos', 'items'], ['ventas_ordenes', 'items'],
  ['ventas_medios_pago', 'items'], ['ventas_personas_catalogo', 'alumnos'],
];
for (const [action, field, params = {}] of contracts) {
  test(`API ${action} ${JSON.stringify(params)} devuelve ${field || 'lista'}`, async ({ request }) => {
    const body = await apiCall(request, action, { params });
    if (field) expect(body.exito).toBe(true);
    expect(Array.isArray(field ? body[field] : body)).toBe(true);
  });
}
test('catálogos conservan estructura y meses válidos', async ({ request }) => {
  const body = await apiCall(request, 'obtener_listas');
  for (const key of ['anios', 'divisiones', 'categorias', 'meses', 'sexos', 'tipos_documentos', 'medios_pago', 'contable_categorias', 'contable_descripciones', 'contable_proveedores']) expect(Array.isArray(body.listas[key]), key).toBe(true);
  const ids = body.listas.meses.map(row => Number(row.id));
  expect(new Set(ids).size).toBe(ids.length);
  // Cooperadora usa 1..12 para meses y 13..16 para conceptos escolares.
  // No son meses corruptos: anual, matricula, primera y segunda mitad.
  const conceptosEscolares = new Map([
    [13, /^CONTADO ANUAL$/], [14, /^MATRICULA$/],
    [15, /^1(?:ER|ERA) MITAD$/], [16, /^2DA MITAD$/],
  ]);
  for (const row of body.listas.meses) {
    const id = Number(row.id);
    expect(Number.isInteger(id) && id >= 1 && id <= 16, `Concepto de cuota inválido: ${row.id}`).toBe(true);
    const nombre = String(row.nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
    expect(nombre, `Falta nombre para el concepto ${id}`).not.toBe('');
    if (conceptosEscolares.has(id)) expect(nombre).toMatch(conceptosEscolares.get(id));
  }
});
test('dashboard de ventas devuelve contadores y total numéricos', async ({ request }) => {
  const body = await apiCall(request, 'ventas_dashboard');
  for (const key of ['campanias_total', 'campanias_activas', 'productos_activos', 'ordenes_aprobadas', 'total_aprobado']) {
    expect(typeof body.resumen[key], key).toBe('number');
    expect(Number.isFinite(body.resumen[key]), key).toBe(true);
  }
});
test('menú de ventas devuelve disponibilidad booleana', async ({ request }) => {
  const body = await apiCall(request, 'ventas_menu_activo');
  expect(typeof body.mostrar_opcion_menu).toBe('boolean');
  expect(Array.isArray(body.campanias)).toBe(true);
});
test('monto de matrícula es numérico y no negativo', async ({ request }) => {
  const body = await apiCall(request, 'matricula');
  expect(Number.isFinite(Number(body.monto))).toBe(true);
  expect(Number(body.monto)).toBeGreaterThanOrEqual(0);
});
