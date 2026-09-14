const { test, expect } = require('./fixtures/auth.fixture');
const { installApiMock } = require('./helpers/mock-api.helper');

const campania = {
  id_campania: 10,
  nombre: 'VENTA ESCOLAR TEST',
  pregunta_persona: 'Ingresá DNI',
  activo: 1,
  disponible_menu: 1,
  producto_principal_id: 20,
  producto_principal_nombre: 'ENTRADA TEST',
  producto_principal_precio: 10000,
  producto_principal_precio_anticipada: 10000,
  producto_principal_precio_puerta: 12000,
  productos_activos: 1,
  ordenes_total: 1,
  fecha_inicio: '2026-09-01',
  fecha_fin: '2026-09-30',
};
const producto = {
  id_producto: 20,
  nombre: 'ENTRADA TEST',
  descripcion: 'Producto E2E',
  precio: 10000,
  precio_anticipada: 10000,
  precio_puerta: 12000,
  activo: 1,
  stock: 100,
};
const orden = {
  id_orden: 30,
  id_campania: 10,
  campania_nombre: 'VENTA ESCOLAR TEST',
  persona_nombre: 'PEREZ JUAN',
  persona_dni: '30123456',
  medio_pago: 'EFECTIVO',
  id_medio_pago: 1,
  total: 10000,
  estado: 'aprobada',
  retirado: 0,
  origen: 'manual',
  creado_en: '2026-09-14 10:00:00',
  items: [{ id_producto: 20, producto_nombre: 'ENTRADA TEST', columna_codigo: 'VEN', columna_nombre: 'ENTRADA TEST', cantidad: 1, precio_tipo: 'anticipada', precio_unitario: 10000 }],
};

async function mockVentas(page, extra = {}) {
  return installApiMock(page, {
    ventas_dashboard: { exito: true, resumen: { campanias_total: 1, campanias_activas: 1, campanias_visibles_menu: 1, productos_activos: 1, ordenes_aprobadas: 1, total_aprobado: 10000 } },
    ventas_campanias: { exito: true, items: [campania] },
    ventas_productos: { exito: true, items: [producto] },
    ventas_ordenes: { exito: true, items: [orden], total: 1 },
    ventas_medios_pago: { exito: true, items: [{ id_medio_pago: 1, nombre: 'EFECTIVO', medio_pago: 'EFECTIVO' }] },
    ventas_personas_catalogo: { exito: true, alumnos: [], personas: [{ id_persona: 1, dni: '30123456', nombre_apellido: 'PEREZ JUAN' }] },
    ventas_planillas_opciones: { exito: true, anios: [{ id_anio: 1, nombre: '1°' }], divisiones: [{ id_division: 1, nombre: 'A' }], total_docentes: 3 },
    ventas_campania_guardar: { exito: true },
    ventas_producto_guardar: { exito: true },
    ventas_persona_guardar: { exito: true, persona: { id_persona: 2, dni: '40000000', nombre_apellido: 'PERSONA TEST' } },
    ventas_orden_guardar: { exito: true },
    ventas_campania_estado: { exito: true },
    ventas_campania_eliminar: { exito: true },
    ventas_producto_estado: { exito: true },
    ventas_producto_eliminar: { exito: true },
    ventas_orden_retiro: { exito: true },
    ventas_orden_eliminar: { exito: true },
    ...extra,
  }, { strict: true });
}

test('ventas navega por las cuatro tablas actuales', async ({ page }) => {
  await mockVentas(page);
  await page.goto('/ventas');
  await expect(page.getByRole('heading', { name: 'Ventas escolares', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Cambiar tabla de ventas' });
  await expect(page.getByRole('table', { name: 'Ventas configuradas' })).toBeVisible();
  await nav.getByRole('button', { name: 'Productos', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Catálogo de productos' })).toBeVisible();
  await nav.getByRole('button', { name: 'Ventas registradas', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Ventas registradas' })).toBeVisible();
  await nav.getByRole('button', { name: /Planillas/i }).click();
  await expect(page.getByText('Exportación masiva', { exact: true })).toBeVisible();
});

test('configuración abre alta y edición de venta', async ({ page }) => {
  await mockVentas(page);
  await page.goto('/ventas');
  await page.getByRole('button', { name: /Nueva venta/i }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Nueva venta', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByTitle('Editar venta').click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Editar venta', exact: true })).toBeVisible();
});

test('productos abre alta y edición', async ({ page }) => {
  await mockVentas(page);
  await page.goto('/ventas');
  await page.getByRole('navigation', { name: 'Cambiar tabla de ventas' }).getByRole('button', { name: 'Productos', exact: true }).click();
  await page.getByRole('button', { name: /Agregar producto/i }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Nuevo producto', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByTitle('Editar producto').click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Editar producto', exact: true })).toBeVisible();
});

test('ventas registradas carga solo aprobadas y permite filtrar retiro/buscar', async ({ page }) => {
  const api = await mockVentas(page);
  await page.goto('/ventas');
  await page.getByRole('navigation', { name: 'Cambiar tabla de ventas' }).getByRole('button', { name: 'Ventas registradas', exact: true }).click();
  await expect(page.getByText('PEREZ JUAN', { exact: false })).toBeVisible();
  const ventaCalls = api.byAction('ventas_ordenes');
  expect(ventaCalls.some(c => c.params.estado === 'aprobada')).toBe(true);
  await page.getByPlaceholder('Buscar venta').fill('PEREZ');
  await page.getByPlaceholder('Buscar venta').press('Enter');
  await expect.poll(() => api.byAction('ventas_ordenes').some(c => c.params.q === 'PEREZ')).toBe(true);
});

test('nueva venta registrada abre el flujo actual', async ({ page }) => {
  await mockVentas(page);
  await page.goto('/ventas');
  await page.getByRole('navigation', { name: 'Cambiar tabla de ventas' }).getByRole('button', { name: 'Ventas registradas', exact: true }).click();
  await page.getByRole('button', { name: /Nueva venta/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Nueva venta registrada', exact: true })).toBeVisible();
  await expect(dialog.getByText('Productos y conceptos', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Comprador o alumno', { exact: true })).toBeVisible();
});

test('planillas carga opciones, cambia a docentes y habilita exportación con venta', async ({ page }) => {
  const api = await mockVentas(page);
  await page.goto('/ventas');
  await page.getByRole('navigation', { name: 'Cambiar tabla de ventas' }).getByRole('button', { name: /Planillas/i }).click();
  await expect.poll(() => api.byAction('ventas_planillas_opciones').length).toBeGreaterThanOrEqual(1);
  const selects = page.locator('.ventas-planillas-form-grid select');
  await selects.nth(0).selectOption('10');
  await expect(page.getByRole('button', { name: /Exportar planillas/i })).toBeEnabled();
  await selects.nth(1).selectOption('docentes');
  await expect(page.getByRole('heading', { name: 'Listado completo de profesores', exact: true })).toBeVisible();
  await expect(page.getByText(/Incluir solo docentes activos/i)).toBeVisible();
});


test('planillas construye la exportación PDF con ventas_planillas_cursos', async ({ page }) => {
  await page.addInitScript(() => {
    window.__pwOpenedUrls = [];
    window.open = (url) => {
      window.__pwOpenedUrls.push(String(url));
      return { opener: null };
    };
  });
  await mockVentas(page);
  await page.goto('/ventas');
  await page.getByRole('navigation', { name: 'Cambiar tabla de ventas' }).getByRole('button', { name: /Planillas/i }).click();
  const selects = page.locator('.ventas-planillas-form-grid select');
  await selects.nth(0).selectOption('10');
  await page.getByRole('button', { name: /Exportar planillas/i }).click();
  const urls = await page.evaluate(() => window.__pwOpenedUrls || []);
  expect(urls).toHaveLength(1);
  const u = new URL(urls[0]);
  expect(u.searchParams.get('action')).toBe('ventas_planillas_cursos');
  expect(u.searchParams.get('id_campania')).toBe('10');
  expect(u.searchParams.get('tipo')).toBe('cursos');
  expect(u.searchParams.get('solo_activos')).toBe('1');
});


test('configuración de ventas guarda, cambia estado y elimina', async ({ page }) => {
  const api = await mockVentas(page);
  await page.goto('/ventas');

  await page.getByTitle('Editar venta').click();
  let dialog = page.getByRole('dialog').filter({ hasText: 'Editar venta' });
  await dialog.locator('select').selectOption('20');
  await dialog.getByRole('button', { name: 'Guardar venta', exact: true }).click();
  await expect.poll(() => api.byAction('ventas_campania_guardar').length).toBe(1);

  await page.getByTitle('Dar de baja venta').click();
  dialog = page.getByRole('dialog').filter({ hasText: 'Dar de baja venta' });
  await dialog.getByRole('button', { name: 'Dar de baja', exact: true }).click();
  await expect.poll(() => api.byAction('ventas_campania_estado').length).toBe(1);

  await page.getByTitle('Eliminar venta definitivamente').click();
  dialog = page.getByRole('dialog').filter({ hasText: 'Eliminar venta' });
  await dialog.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect.poll(() => api.byAction('ventas_campania_eliminar').length).toBe(1);
});

test('productos guarda, cambia estado y elimina', async ({ page }) => {
  const api = await mockVentas(page);
  await page.goto('/ventas');
  await page.getByRole('navigation', { name: 'Cambiar tabla de ventas' }).getByRole('button', { name: 'Productos', exact: true }).click();

  await page.getByTitle('Editar producto').click();
  let dialog = page.getByRole('dialog').filter({ hasText: 'Editar producto' });
  await dialog.getByRole('button', { name: 'Guardar producto', exact: true }).click();
  await expect.poll(() => api.byAction('ventas_producto_guardar').length).toBe(1);

  await page.getByTitle('Dar de baja producto').click();
  dialog = page.getByRole('dialog').filter({ hasText: 'Dar de baja producto' });
  await dialog.getByRole('button', { name: 'Dar de baja', exact: true }).click();
  await expect.poll(() => api.byAction('ventas_producto_estado').length).toBe(1);

  await page.getByTitle('Eliminar producto definitivamente').click();
  dialog = page.getByRole('dialog').filter({ hasText: 'Eliminar producto' });
  await dialog.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect.poll(() => api.byAction('ventas_producto_eliminar').length).toBe(1);
});

test('ventas registradas actualiza venta, persona, retiro y eliminación', async ({ page }) => {
  const api = await mockVentas(page);
  await page.goto('/ventas');
  await page.getByRole('navigation', { name: 'Cambiar tabla de ventas' }).getByRole('button', { name: 'Ventas registradas', exact: true }).click();

  await page.getByTitle('Editar venta registrada').click();
  let dialog = page.getByRole('dialog').filter({ hasText: 'Editar venta registrada' });
  await expect(dialog.getByRole('button', { name: 'Actualizar venta', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Actualizar venta', exact: true }).click();
  await expect.poll(() => api.byAction('ventas_orden_guardar').length).toBe(1);

  await page.getByTitle('Editar venta registrada').click();
  dialog = page.getByRole('dialog').filter({ hasText: 'Editar venta registrada' });
  const personaInput = dialog.getByPlaceholder('Escribí DNI o nombre registrado');
  await personaInput.fill('PERSONA NUEVA');
  await dialog.getByRole('button', { name: /Agregar nueva persona/i }).click();
  const personaDialog = page.getByRole('dialog').filter({ hasText: 'Agregar nueva persona' });
  await personaDialog.getByPlaceholder('Ej: 30123456').fill('40111222');
  await personaDialog.getByPlaceholder('Ej: PEREZ JUAN').fill('PERSONA NUEVA');
  await personaDialog.getByRole('button', { name: 'Guardar persona', exact: true }).click();
  await expect.poll(() => api.byAction('ventas_persona_guardar').length).toBe(1);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();

  await page.getByTitle('Cambiar estado de retiro').click();
  dialog = page.getByRole('dialog').filter({ hasText: 'Estado de retiro' });
  await dialog.getByRole('button', { name: /Retirado/i }).click();
  await dialog.getByRole('button', { name: 'Guardar estado', exact: true }).click();
  await expect.poll(() => api.byAction('ventas_orden_retiro').length).toBe(1);

  await page.getByTitle('Eliminar venta registrada').click();
  dialog = page.getByRole('dialog').filter({ hasText: 'Eliminar venta registrada' });
  await dialog.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect.poll(() => api.byAction('ventas_orden_eliminar').length).toBe(1);
});
