const { test, expect } = require('./fixtures/auth.fixture');
const { installApiMock } = require('./helpers/mock-api.helper');

const baja = {
  id_alumno: 201,
  apellido: 'ALUMNO',
  nombre: 'DADO DE BAJA',
  ingreso: '2026-03-01',
  motivo: 'CAMBIO DE INSTITUCIÓN',
};

async function mockBajas(page, extra = {}) {
  return installApiMock(page, {
    alumnos_baja: { exito: true, alumnos: [baja] },
    dar_alta_alumno: { exito: true, mensaje: 'Reactivado' },
    eliminar_bajas: { exito: true, eliminados: 1 },
    ...extra,
  }, { strict: true });
}

test('bajas busca por alumno', async ({ page }) => {
  await mockBajas(page);
  await page.goto('/alumnos/baja');
  await expect(page.getByRole('heading', { name: 'Alumnos Dados de Baja', exact: true })).toBeVisible();
  const search = page.getByPlaceholder('Buscar por apellido o nombre...');
  await search.fill('DADO');
  await expect(page.getByText(/ALUMNO.*DADO DE BAJA/i)).toBeVisible();
  await search.fill('NO EXISTE');
  await expect(page.getByText(/ALUMNO.*DADO DE BAJA/i)).toHaveCount(0);
});

test('dar de alta permite elegir fecha y confirma', async ({ page }) => {
  const api = await mockBajas(page);
  await page.goto('/alumnos/baja');
  await page.getByRole('img', { name: 'Dar de alta' }).click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Reactivar alumno' });
  await expect(dialog).toBeVisible();
  await dialog.locator('#fecha_alta_alumno').fill('2026-09-14');
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect.poll(() => api.byAction('dar_alta_alumno').length).toBe(1);
  expect(api.last('dar_alta_alumno').raw).toContain('fecha_ingreso=2026-09-14');
});

test('eliminación definitiva individual se puede cancelar y confirmar', async ({ page }) => {
  const api = await mockBajas(page);
  await page.goto('/alumnos/baja');
  await page.getByRole('img', { name: 'Eliminar definitivamente' }).click();
  let dialog = page.getByRole('dialog').filter({ hasText: 'Eliminar permanentemente' });
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(api.byAction('eliminar_bajas')).toHaveLength(0);
  await page.getByRole('img', { name: 'Eliminar definitivamente' }).click();
  dialog = page.getByRole('dialog').filter({ hasText: 'Eliminar permanentemente' });
  await dialog.getByRole('button', { name: 'Sí, eliminar', exact: true }).click();
  await expect.poll(() => api.byAction('eliminar_bajas').length).toBe(1);
});
