const { test, expect } = require('./fixtures/auth.fixture');
const { installApiMock } = require('./helpers/mock-api.helper');

const familia = {
  id_familia: 57,
  nombre_familia: 'BENAVIDEZ',
  observaciones: 'FAMILIA DE PRUEBA',
  miembros_total: 2,
  miembros_activos: 2,
  fecha_alta: '2026-03-01',
};

async function mockFamilias(page, extra = {}) {
  return installApiMock(page, {
    familias_listar: { exito: true, familias: [familia] },
    familia_miembros: {
      exito: true,
      miembros: [
        { id_alumno: 101, apellido: 'BENAVIDEZ', nombre: 'JOAQUÍN', dni: '49080302', activo: 1 },
        { id_alumno: 102, apellido: 'BENAVIDEZ', nombre: 'SANTINO', dni: '50742358', activo: 1 },
      ],
    },
    alumnos_sin_familia: {
      exito: true,
      alumnos: [{ id_alumno: 103, apellido: 'BENAVIDEZ', nombre: 'NAHIARA', dni: '54072135', activo: 1 }],
    },
    socios_sin_familia: { exito: true, alumnos: [] },
    familia_guardar: { exito: true, mensaje: 'Guardado' },
    familia_agregar_miembros: { exito: true, mensaje: 'Agregado' },
    familia_quitar_miembro: { exito: true, mensaje: 'Quitado' },
    familia_eliminar: { exito: true, mensaje: 'Eliminada' },
    familias_exportar_excel: { status: 200, contentType: 'text/plain; charset=utf-8', raw: true, body: 'fallback local' },
    ...extra,
  }, { strict: true });
}

test('familias lista, busca y limpia búsqueda', async ({ page }) => {
  await mockFamilias(page);
  await page.goto('/familias');
  await expect(page.getByRole('heading', { name: 'Gestión de familia', exact: true })).toBeVisible();
  await expect(page.getByText('BENAVIDEZ', { exact: true })).toBeVisible();
  const search = page.getByPlaceholder('Buscar familia...');
  await search.fill('inexistente');
  await expect(page.getByText('BENAVIDEZ', { exact: true })).toHaveCount(0);
  await page.getByLabel('Limpiar búsqueda').click();
  await expect(page.getByText('BENAVIDEZ', { exact: true })).toBeVisible();
});

test('nueva familia exige apellido y normaliza a mayúsculas al guardar', async ({ page }) => {
  const api = await mockFamilias(page);
  await page.goto('/familias');
  await page.getByRole('button', { name: /Añadir Familia/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Nueva familia');
  const guardar = dialog.getByRole('button', { name: 'Guardar', exact: true });
  await expect(guardar).toBeDisabled();
  await dialog.getByPlaceholder('EJ.: PÉREZ').fill('gómez');
  await dialog.getByPlaceholder('Notas internas...').fill('nota de prueba');
  await guardar.click();
  await expect.poll(() => api.byAction('familia_guardar').length).toBe(1);
  const payload = api.last('familia_guardar').data;
  expect(payload.nombre_familia).toBe('GÓMEZ');
  expect(payload.observaciones).toBe('NOTA DE PRUEBA');
});

test('editar familia reutiliza el mismo flujo de guardado', async ({ page }) => {
  const api = await mockFamilias(page);
  await page.goto('/familias');
  await page.getByTitle('Editar').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Editar familia');
  await dialog.getByPlaceholder('Notas internas...').fill('actualizada');
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect.poll(() => api.byAction('familia_guardar').length).toBe(1);
  expect(api.last('familia_guardar').data.id_familia).toBe(57);
});

test('gestión de miembros agrega un alumno disponible', async ({ page }) => {
  const api = await mockFamilias(page);
  await page.goto('/familias');
  await page.getByTitle('Gestionar miembros').click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Miembros actuales' });
  await expect(dialog).toContainText('JOAQUÍN');
  await expect(dialog).toContainText('NAHIARA');
  await dialog.getByText('NAHIARA', { exact: false }).click();
  await dialog.getByRole('button', { name: /Agregar seleccionados \(1\)/ }).click();
  await expect.poll(() => api.byAction('familia_agregar_miembros').length).toBe(1);
  expect(api.last('familia_agregar_miembros').data.ids_alumno.map(Number)).toEqual([103]);
});

test('gestión de miembros quita con confirmación', async ({ page }) => {
  const api = await mockFamilias(page);
  await page.goto('/familias');
  await page.getByTitle('Gestionar miembros').click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Miembros actuales' });
  await dialog.getByTitle('Quitar').first().click();
  const confirm = page.locator('.famdel-modal-overlay').filter({ hasText: 'Quitar miembro' });
  await confirm.locator('button.famdel-btn--solid-danger').click();
  await expect.poll(() => api.byAction('familia_quitar_miembro').length).toBe(1);
});

test('eliminar familia permite cancelar y confirmar', async ({ page }) => {
  const api = await mockFamilias(page);
  await page.goto('/familias');
  await page.getByTitle('Eliminar').click();
  let dialog = page.getByRole('dialog').filter({ hasText: 'Eliminar familia' });
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(api.byAction('familia_eliminar')).toHaveLength(0);
  await page.getByTitle('Eliminar').click();
  dialog = page.getByRole('dialog').filter({ hasText: 'Eliminar familia' });
  await dialog.getByTitle('Forzar borrado').click();
  await expect(dialog.locator('input[type="checkbox"]')).toBeChecked();
  await dialog.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect.poll(() => api.byAction('familia_eliminar').length).toBe(1);
});


test('exportar familias ejecuta el endpoint y conserva fallback local', async ({ page }) => {
  const api = await mockFamilias(page);
  await page.goto('/familias');
  await page.getByRole('button', { name: /Exportar Excel/i }).click();
  await expect.poll(() => api.byAction('familias_exportar_excel').length).toBe(1);
  expect(api.last('familias_exportar_excel').params.incluir_miembros).toBe('1');
  await expect.poll(() => api.byAction('familia_miembros').length).toBeGreaterThanOrEqual(1);
});
