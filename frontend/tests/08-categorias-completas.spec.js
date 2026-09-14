const { test, expect } = require('./fixtures/auth.fixture');
const { installApiMock } = require('./helpers/mock-api.helper');

const categorias = [
  { id: 1, descripcion: 'EXTERNO', monto: 10000, monto_anual: 90000, fecha_creacion: '2026-03-01' },
  { id: 2, descripcion: 'INTERNO', monto: 5000, monto_anual: 45000, fecha_creacion: '2026-03-01' },
];
const hermanos = {
  exito: true,
  items: [
    { id_cat_hermanos: 21, id_cat_monto: 1, cantidad_hermanos: 2, monto_mensual: '8000.00', monto_anual: '70000.00', activo: 1 },
    { id_cat_hermanos: 22, id_cat_monto: 1, cantidad_hermanos: 3, monto_mensual: '6666.67', monto_anual: '60000.00', activo: 1 },
  ],
};

async function mockCategorias(page, extra = {}) {
  return installApiMock(page, {
    cat_listar: categorias,
    cat_hermanos_listar: hermanos,
    cat_historial: { exito: true, historial: [{ tipo: 'MENSUAL', precio_anterior: 9000, precio_nuevo: 10000, fecha_cambio: '2026-03-01' }] },
    cat_hermanos_historial: { exito: true, historial: [{ id_cat_hermanos: 22, cantidad_hermanos: 3, tipo: 'MENSUAL', precio_anterior: 7000, precio_nuevo: 6666.67, fecha_cambio: '2026-09-14 09:00:00' }] },
    cat_actualizar: { exito: true, mensaje: 'Categoría actualizada' },
    cat_crear: { exito: true, id: 99, mensaje: 'Categoría creada' },
    cat_eliminar: { exito: true, mensaje: 'Categoría eliminada' },
    cat_hermanos_eliminar: { exito: true, mensaje: 'Fila eliminada' },
    ...extra,
  }, { strict: true });
}

test('categorías lista montos y acciones actuales', async ({ page }) => {
  await mockCategorias(page);
  await page.goto('/categorias');
  await expect(page.getByRole('heading', { name: 'Categorías', exact: true })).toBeVisible();
  await expect(page.getByText('EXTERNO', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Ver historial de EXTERNO')).toBeVisible();
  await expect(page.getByLabel('Editar categoría EXTERNO')).toBeVisible();
  await expect(page.getByLabel('Eliminar categoría EXTERNO')).toBeVisible();
});

test('historial combina base y grupo familiar', async ({ page }) => {
  const api = await mockCategorias(page);
  await page.goto('/categorias');
  await page.getByLabel('Ver historial de EXTERNO').click();
  await expect(page.getByRole('dialog')).toContainText('Historial · EXTERNO');
  await expect(page.getByRole('button', { name: /3 Hermanos/i })).toBeVisible();
  await page.getByRole('button', { name: /3 Hermanos/i }).click();
  await expect(page.getByRole('dialog')).toContainText('6.667');
  expect(api.byAction('cat_historial').length).toBe(1);
  expect(api.byAction('cat_hermanos_listar').length).toBeGreaterThanOrEqual(1);
  expect(api.byAction('cat_hermanos_historial').length).toBe(1);
});

test('editar categoría acepta decimales en montos de hermanos', async ({ page }) => {
  // Partimos de valores distintos para probar un cambio real. Si el mock ya
  // devuelve 6666.67/60000, el formulario detecta correctamente que no hay
  // nada para guardar y no llama a cat_actualizar.
  const api = await mockCategorias(page, {
    cat_hermanos_listar: {
      exito: true,
      items: [
        { id_cat_hermanos: 21, id_cat_monto: 1, cantidad_hermanos: 2, monto_mensual: '8000.00', monto_anual: '70000.00', activo: 1 },
        { id_cat_hermanos: 22, id_cat_monto: 1, cantidad_hermanos: 3, monto_mensual: '7000.00', monto_anual: '70000.00', activo: 1 },
      ],
    },
  });
  await page.goto('/categorias/editar/1');
  await expect(page.getByRole('heading', { name: 'Editar categoría', exact: true })).toBeVisible();

  const card3 = page.locator('.cat_edi_hCard').filter({ hasText: '3 hermanos' });
  const inputs = card3.locator('input[type="number"]');
  await expect(inputs.nth(0)).toHaveAttribute('step', '0.01');
  await expect(inputs.nth(1)).toHaveAttribute('step', '0.01');
  await inputs.nth(0).fill('6666.67');
  await inputs.nth(1).fill('60000');
  await page.getByRole('button', { name: /Guardar/i }).click();

  await expect.poll(() => api.byAction('cat_actualizar').length).toBe(1);
  const raw = api.last('cat_actualizar').raw;
  expect(raw).toContain('6666.67');
  expect(raw).toContain('60000');
});

test('editar categoría impide duplicar cantidad de hermanos', async ({ page }) => {
  await mockCategorias(page);
  await page.goto('/categorias/editar/1');
  const cantidad = page.locator('.cat_edi_addBox input[type="number"]');
  await cantidad.fill('3');
  await page.getByRole('button', { name: /Agregar fila/i }).click();
  await expect(page.getByText('Ya existe la fila para 3 hermanos.', { exact: true })).toBeVisible();
});

test('editar categoría permite agregar y quitar una fila nueva sin tocar backend', async ({ page }) => {
  const api = await mockCategorias(page);
  await page.goto('/categorias/editar/1');
  const cantidad = page.locator('.cat_edi_addBox input[type="number"]');
  await cantidad.fill('4');
  await page.getByRole('button', { name: /Agregar fila/i }).click();
  const card4 = page.locator('.cat_edi_hCard').filter({ hasText: '4 hermanos' });
  await expect(card4).toBeVisible();
  await card4.getByRole('button', { name: 'Eliminar' }).click();
  await expect(card4).toHaveCount(0);
  expect(api.byAction('cat_hermanos_eliminar')).toHaveLength(0);
});

test('nueva categoría valida y normaliza nombre antes del POST', async ({ page }) => {
  const api = await mockCategorias(page);
  await page.goto('/categorias/nueva');
  await page.getByPlaceholder('Ej: "A"').fill('externo test');
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill('1234');
  await numberInputs.nth(1).fill('9999');
  await page.getByRole('button', { name: /Guardar/i }).click();
  await expect.poll(() => api.byAction('cat_crear').length).toBe(1);
  const raw = api.last('cat_crear').raw;
  expect(raw).toContain('EXTERNO TEST');
  expect(raw).toContain('1234');
  expect(raw).toContain('9999');
});

test('eliminar categoría pide confirmación y cancelar no elimina', async ({ page }) => {
  const api = await mockCategorias(page);
  await page.goto('/categorias');
  await page.getByLabel('Eliminar categoría EXTERNO').click();
  await expect(page.getByRole('heading', { name: 'Eliminar categoría' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(api.byAction('cat_eliminar')).toHaveLength(0);
});

test('eliminar categoría confirma una sola vez', async ({ page }) => {
  const api = await mockCategorias(page);
  await page.goto('/categorias');
  await page.getByLabel('Eliminar categoría EXTERNO').click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect.poll(() => api.byAction('cat_eliminar').length).toBe(1);
});


test('editar categoría elimina una regla familiar existente en backend', async ({ page }) => {
  const api = await mockCategorias(page);
  await page.goto('/categorias/editar/1');
  const card2 = page.locator('.cat_edi_hCard').filter({ hasText: '2 hermanos' });
  await expect(card2).toBeVisible();
  await card2.getByRole('button', { name: 'Eliminar' }).click();
  await expect.poll(() => api.byAction('cat_hermanos_eliminar').length).toBe(1);
  expect(api.last('cat_hermanos_eliminar').raw).toContain('21');
});
