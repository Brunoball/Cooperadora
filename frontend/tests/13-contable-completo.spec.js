const { test, expect } = require('./fixtures/auth.fixture');
const { installApiMock, DEFAULT_LISTAS } = require('./helpers/mock-api.helper');

async function mockContable(page, extra = {}) {
  return installApiMock(page, {
    obtener_listas: { exito: true, listas: DEFAULT_LISTAS },
    contable_ingresos: ({ url }) => {
      if (url.searchParams.get('meta') === '1') return { exito: true, anios_disponibles: [2026] };
      return { exito: true, datos: [], anios_disponibles: [2026], total: 0 };
    },
    ingresos_list: { exito: true, datos: [], ingresos: [] },
    contable_egresos: ({ url }) => {
      if (url.searchParams.get('op') === 'list_years') return { exito: true, anios_disponibles: [2026] };
      return { exito: true, datos: [], anios_disponibles: [2026] };
    },
    contable_resumen: {
      exito: true,
      anios_disponibles: [2026],
      resumen: [
        { mes: 3, nombre_mes: 'Marzo', ingresos: 100000, egresos: 40000, saldo: 60000 },
      ],
      ingresos: 100000,
      egresos: 40000,
      saldo: 60000,
    },
    medio_pago_crear: { exito: true, id: 99, nombre: 'TEST' },
    agregar_categoria: { exito: true, id: 99, nombre: 'TEST' },
    agregar_descripcion: { exito: true, id: 99, nombre: 'TEST' },
    agregar_proveedor: { exito: true, id: 99, nombre: 'TEST' },
    eliminar_ingresos: { exito: true, mensaje: 'Eliminado' },
    contable_egresos_upload: { exito: true, relative_url: 'uploads/egresos/testing-comprobante.png' },
    ...extra,
  }, { strict: true });
}

test('libro contable navega entre Ingresos, Egresos y Resumen', async ({ page }) => {
  await mockContable(page);
  await page.goto('/contable/libro');
  await expect(page.getByRole('heading', { name: 'Contable', exact: true })).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Secciones contables' });
  await expect(tabs.getByRole('tab', { name: 'Ingresos' })).toHaveAttribute('aria-selected', 'true');
  await tabs.getByRole('tab', { name: 'Egresos' }).click();
  await expect(page.getByRole('button', { name: 'Egresos', exact: true })).toBeVisible();
  await tabs.getByRole('tab', { name: 'Resumen' }).click();
  await expect(tabs.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Resumen anual', { exact: true })).toBeVisible();
});

test('ingresos alterna entre cuotas de alumnos e ingresos manuales', async ({ page }) => {
  await mockContable(page);
  await page.goto('/contable/libro');
  const tablaTabs = page.getByRole('tablist', { name: 'Vista de tabla' });
  await tablaTabs.getByRole('tab', { name: 'Ingresos', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Listado de ingresos (tabla ingresos)' })).toBeVisible();
  await tablaTabs.getByRole('tab', { name: 'Alumnos', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Listado de ingresos (alumnos)' })).toBeVisible();
});

test('registrar ingreso abre modal actual y permite cancelar sin mutación', async ({ page }) => {
  const api = await mockContable(page);
  await page.goto('/contable/libro');
  await page.getByRole('button', { name: 'Registrar ingreso', exact: true }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Registrar ingreso' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(api.byAction('contable_ingresos').filter(c => c.method === 'POST')).toHaveLength(0);
});

test('registrar egreso abre modal actual y permite cancelar sin mutación', async ({ page }) => {
  const api = await mockContable(page);
  await page.goto('/contable/libro');
  await page.getByRole('tab', { name: 'Egresos' }).click();
  await page.getByRole('button', { name: 'Registrar egreso', exact: true }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Nuevo egreso' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(api.byAction('contable_egresos').filter(c => c.method === 'POST')).toHaveLength(0);
});

test('resumen muestra totales y resumen anual', async ({ page }) => {
  await mockContable(page);
  await page.goto('/contable/libro');
  await page.getByRole('tab', { name: 'Resumen' }).click();
  await expect(page.getByText('Total Ingresos', { exact: true })).toBeVisible();
  await expect(page.getByText('Total Egresos', { exact: true })).toBeVisible();
  await expect(page.getByText('Resumen anual', { exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Resumen por mes' })).toBeVisible();
});


test('ingreso manual permite eliminar y confirma una sola mutación', async ({ page }) => {
  const api = await mockContable(page, {
    ingresos_list: {
      exito: true,
      anios_disponibles: [2026],
      items: [{
        id_ingreso: 501, fecha: '2026-09-14', categoria: 'OTROS', imputacion: 'INGRESO TEST',
        proveedor: 'PERSONA TEST', importe: 12345, medio: 'EFECTIVO', id_medio_pago: 1, origen_contable: 'manual',
      }],
    },
  });
  await page.goto('/contable/libro');
  const tablaTabs = page.getByRole('tablist', { name: 'Vista de tabla' });
  await tablaTabs.getByRole('tab', { name: 'Ingresos', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Listado de ingresos (tabla ingresos)' })).toContainText('PERSONA TEST');
  await page.getByTitle('Eliminar').click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Eliminar ingreso' });
  await dialog.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect.poll(() => api.byAction('eliminar_ingresos').length).toBe(1);
  expect(Number(api.last('eliminar_ingresos').data.id_ingreso)).toBe(501);
});

test('egreso permite subir comprobante válido antes de guardar', async ({ page }) => {
  const api = await mockContable(page);
  await page.goto('/contable/libro');
  await page.getByRole('tab', { name: 'Egresos' }).click();
  await page.getByRole('button', { name: 'Registrar egreso', exact: true }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Nuevo egreso' });
  const file = dialog.locator('input[type="file"]');
  await file.setInputFiles({ name: 'comprobante.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') });
  await expect.poll(() => api.byAction('contable_egresos_upload').length).toBe(1);
  const call = api.last('contable_egresos_upload');
  expect(call.method).toBe('POST');
  await expect(dialog.getByAltText('Vista previa del comprobante')).toBeVisible();
});


test('registrar ingreso guarda y permite crear catálogos al vuelo', async ({ page }) => {
  const api = await mockContable(page);
  await page.goto('/contable/libro');
  await page.getByRole('button', { name: 'Registrar ingreso', exact: true }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Registrar ingreso' });

  const selectField = (texto) => dialog.locator('.field').filter({ hasText: texto }).locator('select');
  const inputField = (texto) => dialog.locator('.field').filter({ hasText: texto }).locator('input');

  await selectField('Medio de pago').selectOption('__OTRO__');
  await inputField('Nuevo medio de pago').fill('TARJETA');
  await selectField('Proveedor').selectOption('__OTRO__');
  await inputField('Nuevo proveedor').fill('PROVEEDOR 99');
  await selectField('Categoría').selectOption('__OTRO__');
  await inputField('Nueva categoría').fill('DONACIONES');
  await selectField('Imputación').selectOption('__OTRO__');
  await inputField('Nueva imputación').fill('APORTE EXTRA');
  await inputField('Importe').fill('1234.56');
  await dialog.getByRole('button', { name: 'Guardar ingreso', exact: true }).click();

  for (const action of ['medio_pago_crear', 'agregar_categoria', 'agregar_descripcion', 'agregar_proveedor']) {
    await expect.poll(() => api.byAction(action).length, { message: action }).toBe(1);
  }
  await expect.poll(() => api.byAction('contable_ingresos').filter(c => c.method === 'POST').length).toBe(1);
  const payload = api.byAction('contable_ingresos').find(c => c.method === 'POST').data;
  expect(Number(payload.importe)).toBeCloseTo(1234.56, 2);
  expect(Number(payload.id_medio_pago)).toBe(99);
});

test('registrar egreso guarda los catálogos seleccionados e importe decimal', async ({ page }) => {
  const api = await mockContable(page);
  await page.goto('/contable/libro');
  await page.getByRole('tab', { name: 'Egresos' }).click();
  await page.getByRole('button', { name: 'Registrar egreso', exact: true }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Nuevo egreso' });

  const field = (texto) => dialog.locator('.mm_field').filter({ hasText: texto });
  await field('Medio').locator('select').selectOption('1');
  await field('Categoría').locator('select').selectOption('1');
  await field('Proveedor').locator('select').selectOption('1');
  await field('Descripción').locator('select').selectOption('1');
  await field('Importe').locator('input').fill('9876.54');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect.poll(() => api.byAction('contable_egresos').filter(c => c.method === 'POST').length).toBe(1);
  const call = api.byAction('contable_egresos').find(c => c.method === 'POST');
  expect(call.params.op).toBe('create');
  expect(Number(call.data.importe)).toBeCloseTo(9876.54, 2);
});
