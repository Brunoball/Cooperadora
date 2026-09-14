const { test, expect } = require('@playwright/test');
const { apiCall } = require('./helpers/api.helper');

test('API de alumnos permite leer detalle por id sin mutar', async ({ request }) => {
  const lista = await apiCall(request, 'alumnos');
  test.skip(!Array.isArray(lista.alumnos) || lista.alumnos.length === 0, 'No hay alumnos para validar detalle.');
  const id = Number(lista.alumnos[0].id_alumno);
  const detalle = await apiCall(request, 'editar_alumno', { params: { id } });
  expect(detalle.exito).toBe(true);
  expect(Number(detalle.alumno?.id_alumno)).toBe(id);
});

test('API de familias expone miembros y candidatos sin familia', async ({ request }) => {
  const familias = await apiCall(request, 'familias_listar');
  expect(Array.isArray(familias.familias)).toBe(true);
  const sinFamilia = await apiCall(request, 'alumnos_sin_familia', { params: { all: 1 } });
  expect(Array.isArray(sinFamilia.alumnos)).toBe(true);
  if (familias.familias.length) {
    const id = Number(familias.familias[0].id_familia);
    const miembros = await apiCall(request, 'familia_miembros', { params: { id_familia: id } });
    expect(Array.isArray(miembros.miembros || miembros.alumnos)).toBe(true);
  }
});

test('categorías de hermanos admiten importes decimales y estructura vigente', async ({ request }) => {
  const categorias = await apiCall(request, 'cat_listar');
  const rows = Array.isArray(categorias) ? categorias : (categorias.categorias || categorias.data || []);
  test.skip(rows.length === 0, 'No hay categorías para validar reglas familiares.');
  const id = Number(rows[0].id ?? rows[0].id_cat_monto ?? rows[0].id_categoria);
  const reglas = await apiCall(request, 'cat_hermanos_listar', { params: { id_cat_monto: id } });
  expect(Array.isArray(reglas.items)).toBe(true);
  for (const r of reglas.items) {
    expect(Number.isFinite(Number(r.monto_mensual))).toBe(true);
    expect(Number.isFinite(Number(r.monto_anual))).toBe(true);
    expect(Number(r.cantidad_hermanos)).toBeGreaterThanOrEqual(2);
  }
});

test('monto de categoría devuelve precio histórico por período y regla familiar exacta', async ({ request }) => {
  const alumnos = await apiCall(request, 'alumnos');
  test.skip(!alumnos.alumnos?.length, 'No hay alumnos para validar cuotas.');

  // Preferimos un alumno con familia para cubrir el flujo que cambió.
  let elegido = null;
  let familia = null;
  for (const alumno of alumnos.alumnos.slice(0, 25)) {
    const info = await apiCall(request, 'obtener_info_familia', { params: { id_alumno: alumno.id_alumno } });
    const cantidad = Math.max(Number(info.miembros_activos || 0), Number(info.miembros_total || 0));
    if (info.tiene_familia && cantidad >= 2) {
      elegido = alumno;
      familia = info;
      break;
    }
  }
  if (!elegido) {
    elegido = alumnos.alumnos[0];
    familia = { tiene_familia: false, miembros_activos: 1, miembros_total: 1 };
  }

  const familyCount = familia.tiene_familia
    ? Math.max(1, Number(familia.miembros_activos || 0), Number(familia.miembros_total || 0))
    : 1;
  const monto = await apiCall(request, 'obtener_monto_categoria', {
    params: { id_alumno: elegido.id_alumno, family_count: familyCount, anio: 2026 },
  });
  expect(Number(monto.family_count)).toBe(familyCount);
  expect(Number.isFinite(Number(monto.monto_mensual))).toBe(true);
  expect(Number.isFinite(Number(monto.monto_anual))).toBe(true);
  for (let mes = 3; mes <= 12; mes++) {
    expect(Number.isFinite(Number(monto.montos_por_periodo?.[mes])), `Falta monto histórico del mes ${mes}`).toBe(true);
  }
});

test('meses pagados devuelve estado consumible por el modal', async ({ request }) => {
  const alumnos = await apiCall(request, 'alumnos');
  test.skip(!alumnos.alumnos?.length, 'No hay alumnos para validar meses pagados.');
  const id = Number(alumnos.alumnos[0].id_alumno);
  const body = await apiCall(request, 'meses_pagados', { params: { id_alumno: id, anio: 2026 } });
  expect(body.exito).toBe(true);
  const detalles = body.detalles || body.items || body.rows || body.data || [];
  const ids = body.meses_pagados || body.periodos_pagados || [];
  expect(Array.isArray(detalles) || Array.isArray(ids)).toBe(true);
});


test('API de comprobante devuelve los datos enriquecidos de un alumno', async ({ request }) => {
  const alumnos = await apiCall(request, 'alumnos');
  test.skip(!alumnos.alumnos?.length, 'No hay alumnos para validar comprobante.');
  const id = Number(alumnos.alumnos[0].id_alumno);
  const body = await apiCall(request, 'obtener_socio_comprobante', { params: { id } });
  expect(body.exito).toBe(true);
  expect(body.socio).toBeTruthy();
  const returnedId = Number(body.socio.id_alumno ?? body.socio.id ?? 0);
  if (returnedId) expect(returnedId).toBe(id);
});
