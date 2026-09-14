const { test, expect } = require('./fixtures/auth.fixture');
const { installApiMock } = require('./helpers/mock-api.helper');

async function mockDocumentos(page, extra = {}) {
  return installApiMock(page, {
    td_listar: {
      exito: true,
      tipos_documentos: [
        { id_tipo_documento: 1, descripcion: 'DOCUMENTO NACIONAL DE IDENTIDAD', sigla: 'DNI' },
        { id_tipo_documento: 2, descripcion: 'PASAPORTE', sigla: 'PAS' },
      ],
    },
    td_crear: { exito: true, mensaje: 'Creado' },
    td_actualizar: { exito: true, mensaje: 'Actualizado' },
    td_eliminar: { exito: true, mensaje: 'Eliminado' },
    ...extra,
  }, { strict: true });
}

test('tipos de documento lista y filtra', async ({ page }) => {
  await mockDocumentos(page);
  await page.goto('/tipos-documentos');
  await expect(page.getByRole('heading', { name: 'Tipos de Documento', exact: true })).toBeVisible();
  const search = page.locator('input[type="search"]');
  if (await search.count()) {
    await search.fill('PAS');
    await expect(page.getByText('PASAPORTE', { exact: true })).toBeVisible();
    await expect(page.getByText('DOCUMENTO NACIONAL DE IDENTIDAD', { exact: true })).toHaveCount(0);
  }
});

test('crear documento normaliza descripción y sigla', async ({ page }) => {
  const api = await mockDocumentos(page);
  await page.goto('/tipos-documentos');
  await page.getByPlaceholder('(ej: Documento Nacional de Identidad)').fill('cédula test');
  await page.getByPlaceholder('(ej: DNI)').fill('ct');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect.poll(() => api.byAction('td_crear').length).toBe(1);
  expect(api.last('td_crear').raw).toContain('CÉDULA TEST');
  expect(api.last('td_crear').raw).toContain('CT');
});

test('editar documento carga datos y usa td_actualizar', async ({ page }) => {
  const api = await mockDocumentos(page);
  await page.goto('/tipos-documentos');
  await page.getByLabel('Editar tipo de documento PASAPORTE').click();
  await expect(page.getByPlaceholder('(ej: Documento Nacional de Identidad)')).toHaveValue('PASAPORTE');
  await page.getByPlaceholder('(ej: Documento Nacional de Identidad)').fill('pasaporte argentino');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect.poll(() => api.byAction('td_actualizar').length).toBe(1);
  expect(api.last('td_actualizar').raw).toContain('PASAPORTE ARGENTINO');
});

test('cancelar edición no genera mutación', async ({ page }) => {
  const api = await mockDocumentos(page);
  await page.goto('/tipos-documentos');
  await page.getByLabel('Editar tipo de documento PASAPORTE').click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(api.byAction('td_actualizar')).toHaveLength(0);
});

test('eliminar documento exige confirmación', async ({ page }) => {
  const api = await mockDocumentos(page);
  await page.goto('/tipos-documentos');
  await page.getByLabel('Eliminar tipo de documento PASAPORTE').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Eliminar tipo de documento');
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect.poll(() => api.byAction('td_eliminar').length).toBe(1);
});
