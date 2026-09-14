const { test, expect } = require('./fixtures/auth.fixture');
const { installApiMock, DEFAULT_LISTAS } = require('./helpers/mock-api.helper');

const ALUMNO = {
  id_alumno: 101,
  nombre: 'BENAVIDEZ, JOAQUÍN RAMÓN',
  documento: '49080302',
  domicilio: 'CALLE TEST 123',
  id_categoria: 1,
  id_division: 1,
  id_anio: 1,
  anio_nombre: '1°',
  id_mes: 3,
  estado_pago: 'deudor',
  es_cobrador: 0,
};

const FAMILIA = {
  exito: true,
  tiene_familia: true,
  id_familia: 57,
  nombre_familia: 'BENAVIDEZ',
  miembros_total: 3,
  miembros_activos: 3,
  miembros: [
    { id_alumno: 101, apellido_nombre: 'BENAVIDEZ, JOAQUÍN RAMÓN', activo: 1 },
    { id_alumno: 102, apellido_nombre: 'BENAVIDEZ, SANTINO', activo: 1 },
    { id_alumno: 103, apellido_nombre: 'BENAVIDEZ, NAHIARA', activo: 1 },
  ],
};

const MONTO_FAMILIA_3 = {
  exito: true,
  id_alumno: 101,
  id_cat_monto: 1,
  categoria_nombre: 'EXTERNO',
  anio: 2026,
  family_count: 3,
  base_monto_mensual: 10000,
  base_monto_anual: 90000,
  monto_mensual: 6666.67,
  monto_anual: 60000,
  // El sistema actual conserva el valor histórico de cada mes.
  montos_por_periodo: {
    3: 6666.67,
    4: 7000,
    5: 7000,
    6: 7000,
    7: 7000,
    8: 7000,
    9: 7000,
    10: 6666.67,
    11: 6666.67,
    12: 6666.67,
  },
  override_aplicado: true,
  id_cat_hermanos: 22,
};

async function mockCuotas(page, extra = {}) {
  return installApiMock(page, {
    cuotas: ({ url }) => {
      if (url.searchParams.get('listar_anios') === '1') {
        return { exito: true, anios: [{ id: 2026, nombre: '2026' }] };
      }
      const mes = Number(url.searchParams.get('id_mes') || 3);
      return { exito: true, cuotas: [{ ...ALUMNO, id_mes: mes || 3 }] };
    },
    obtener_listas: { exito: true, listas: DEFAULT_LISTAS },
    obtener_info_familia: FAMILIA,
    obtener_monto_categoria: MONTO_FAMILIA_3,
    obtener_monto_matricula: { exito: true, monto: 25000 },
    meses_pagados: { exito: true, meses_pagados: [], detalles: [] },
    registrar_pago: {
      exito: true,
      mensaje: 'Pago registrado',
      redondeo_grupo_aplicado: true,
      asignaciones_grupo_por_periodo: { 3: { 101: 6667, 102: 6667, 103: 6666 } },
    },
    actualizar_monto_matricula: { exito: true, monto: 25000 },
    buscar_pago_eliminar: { exito: true, id_mes_real: 3, warning: false },
    eliminar_pago: { exito: true, mensaje: 'Registro eliminado' },
    ...extra,
  }, { strict: true });
}

async function abrirPago(page) {
  await page.goto('/cuotas');
  await expect(page.getByRole('heading', { name: 'Gestión de Cuotas', exact: true })).toBeVisible();
  await page.locator('#meses').selectOption('3');
  await expect(page.getByText('BENAVIDEZ, JOAQUÍN RAMÓN', { exact: true })).toBeVisible();
  await page.getByTitle('Registrar pago / Condonar').click();
  await expect(page.getByRole('heading', { name: 'Registro de Pagos / Condonar', exact: true })).toBeVisible();
  await expect(page.getByText('Fam: Sí (3)', { exact: true })).toBeVisible();
}

test('cuotas conserva los precios históricos por mes del grupo familiar', async ({ page }) => {
  await mockCuotas(page);
  await abrirPago(page);
  await expect(page.getByText(/MARZO\s*•\s*\$\s*6\.666,67/i)).toBeVisible();
  await expect(page.getByText(/ABRIL\s*•\s*\$\s*7\.000/i)).toBeVisible();
  await expect(page.getByText(/OCTUBRE\s*•\s*\$\s*6\.666,67/i)).toBeVisible();
});

test('pago mensual familiar redondea 6.666,67 x 3 a $20.000', async ({ page }) => {
  const api = await mockCuotas(page);
  await abrirPago(page);

  await page.locator('.periodo-card').filter({ hasText: 'MARZO' }).click();
  await expect(page.getByText(/Total grupo \(3\):\s*\$\s*20\.000(?!,01)/i)).toBeVisible();

  await page.locator('#medio-pago-select').selectOption('1');
  await page.getByRole('button', { name: 'Confirmar Pago', exact: true }).click();
  await expect.poll(() => api.byAction('registrar_pago').length).toBe(1);

  const llamada = api.last('registrar_pago');
  const payload = typeof llamada.data === 'object' ? llamada.data : JSON.parse(llamada.raw);
  expect(payload.aplicar_a_familia).toBe(true);
  expect(payload.ids_familia.map(Number).sort((a, b) => a - b)).toEqual([102, 103]);
  expect(Number(payload.montos_por_periodo['3'])).toBeCloseTo(6666.67, 2);
});

test('contado anual usa $60.000 por alumno y $180.000 para tres', async ({ page }) => {
  await mockCuotas(page);
  await abrirPago(page);
  const anual = page.locator('.condonar-box').filter({ hasText: 'CONTADO ANUAL' });
  await anual.locator('label.condonar-check').first().click();
  await expect(anual).toContainText('$ 60.000');
  await expect(page.getByText(/Total grupo \(3\):\s*\$\s*180\.000/i)).toBeVisible();
});

test('primera y segunda mitad anual usan exactamente la mitad del anual configurado', async ({ page }) => {
  await mockCuotas(page);
  await abrirPago(page);
  const anual = page.locator('.condonar-box').filter({ hasText: 'CONTADO ANUAL' });
  await anual.locator('label.condonar-check').first().click();
  await anual.locator('label.condonar-check').filter({ hasText: /1ª mitad/ }).click();
  await expect(anual).toContainText('Importe: $ 30.000');
  await expect(page.getByText(/Total grupo \(3\):\s*\$\s*90\.000/i)).toBeVisible();
});

test('monto libre mensual acepta decimales y también redondea el total familiar', async ({ page }) => {
  await mockCuotas(page);
  await abrirPago(page);
  const libre = page.locator('.condonar-box').filter({ hasText: 'Usar monto libre por mes' });
  await libre.locator('label.condonar-check').click();
  const input = page.getByPlaceholder('Ingresá el monto libre por mes');
  await input.fill('6666.67');
  await page.locator('.periodo-card').filter({ hasText: 'MARZO' }).click();
  await expect(page.getByText(/Total grupo \(3\):\s*\$\s*20\.000(?!,01)/i)).toBeVisible();
});

test('condonar no exige medio de pago y nunca genera importe', async ({ page }) => {
  const api = await mockCuotas(page);
  await abrirPago(page);
  const condonar = page.locator('.condonar-box').filter({ hasText: 'Marcar como' });
  await condonar.locator('label.condonar-check').click();
  await page.locator('.periodo-card').filter({ hasText: 'MARZO' }).click();
  await expect(page.getByText(/Total grupo \(3\):\s*\$\s*0/i)).toBeVisible();
  await expect(page.locator('#medio-pago-select')).toBeDisabled();
  await page.getByRole('button', { name: 'Condonar', exact: true }).click();
  await expect.poll(() => api.byAction('registrar_pago').length).toBe(1);
});

test('seleccionar todos respeta meses ya pagados o cubiertos', async ({ page }) => {
  await mockCuotas(page, {
    meses_pagados: {
      exito: true,
      detalles: [
        { id_mes: 3, estado: 'pagado' },
        { id_mes: 4, estado: 'condonado' },
        { id_mes: 13, estado: 'pagado' },
      ],
    },
  });
  await abrirPago(page);
  await expect(page.locator('#periodo-3')).toBeDisabled();
  await expect(page.locator('#periodo-4')).toBeDisabled();
  await expect(page.getByText(/MARZO.*Pagado/i)).toBeVisible();
  await expect(page.getByText(/ABRIL.*Condonado/i)).toBeVisible();
});


test('eliminar un pago consulta el período real antes de borrar', async ({ page }) => {
  const api = await mockCuotas(page, {
    cuotas: ({ url }) => {
      if (url.searchParams.get('listar_anios') === '1') return { exito: true, anios: [{ id: 2026, nombre: '2026' }] };
      return { exito: true, cuotas: [{ ...ALUMNO, id_mes: 3, estado_pago: 'pagado' }] };
    },
  });
  await page.goto('/cuotas');
  await page.locator('#meses').selectOption('3');
  await page.locator('.gcuotas-tab-button[title="Pagados"]').click();
  await expect(page.getByTitle('Eliminar pago')).toBeVisible();
  await page.getByTitle('Eliminar pago').click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Eliminar Pago' });
  const eliminar = dialog.getByRole('button', { name: 'Eliminar', exact: true });

  // En desarrollo React StrictMode puede ejecutar el useEffect de apertura dos
  // veces. Lo importante es que al menos una consulta correcta termine y que
  // la mutación de borrado ocurra una sola vez al confirmar.
  await expect(eliminar).toBeEnabled();
  const consultas = api.byAction('buscar_pago_eliminar');
  expect(consultas.length).toBeGreaterThanOrEqual(1);
  for (const consulta of consultas) {
    expect(Number(consulta.data?.id_alumno)).toBe(101);
    expect(Number(consulta.data?.id_mes)).toBe(3);
    expect(Number(consulta.data?.anio)).toBe(2026);
  }

  await eliminar.click();
  await expect.poll(() => api.byAction('eliminar_pago').length).toBe(1);
});

test('eliminar condonación exige estado esperado condonado', async ({ page }) => {
  const api = await mockCuotas(page, {
    cuotas: ({ url }) => {
      if (url.searchParams.get('listar_anios') === '1') return { exito: true, anios: [{ id: 2026, nombre: '2026' }] };
      return { exito: true, cuotas: [{ ...ALUMNO, id_mes: 3, estado_pago: 'condonado' }] };
    },
  });
  await page.goto('/cuotas');
  await page.locator('#meses').selectOption('3');
  await page.locator('.gcuotas-tab-button[title="Condonados"]').click();
  await page.getByTitle('Eliminar condonación').click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Eliminar Condonación' });
  await dialog.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect.poll(() => api.byAction('eliminar_pago').length).toBe(1);
  expect(api.last('eliminar_pago').data.estado_esperado).toBe('condonado');
});


test('matrícula permite actualizar el monto global', async ({ page }) => {
  const api = await mockCuotas(page, { actualizar_monto_matricula: { exito: true, monto: 26000 } });
  await abrirPago(page);
  await page.getByTitle('Editar monto global').click();
  const input = page.locator('.matricula-input');
  await input.fill('26000');
  await page.getByLabel('Guardar matrícula global').click();
  await expect.poll(() => api.byAction('actualizar_monto_matricula').length).toBe(1);
  expect(Number(api.last('actualizar_monto_matricula').data.monto)).toBe(26000);
});
