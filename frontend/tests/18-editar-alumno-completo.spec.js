const { test, expect } = require('./fixtures/auth.fixture');
const { installApiMock, DEFAULT_LISTAS } = require('./helpers/mock-api.helper');

const alumno = {
  id_alumno: 101,
  apellido: 'BENAVIDEZ',
  nombre: 'JOAQUÍN RAMÓN',
  id_tipo_documento: 1,
  num_documento: '49080302',
  id_sexo: 2,
  domicilio: 'CALLE TEST 123',
  localidad: 'CÓRDOBA',
  telefono: '3510000000',
  id_anio: 1,
  id_division: 1,
  id_categoria: 1,
  id_cat_monto: 1,
  ingreso: '2026-03-01',
  observaciones: 'OBS ORIGINAL',
};

async function mockEditar(page) {
  return installApiMock(page, {
    obtener_listas: { exito: true, listas: DEFAULT_LISTAS },
    editar_alumno: ({ request }) => request.method() === 'GET'
      ? { exito: true, alumno }
      : { exito: true, mensaje: 'Alumno actualizado correctamente' },
  }, { strict: true });
}

test('editar alumno carga el registro actual y todas sus relaciones', async ({ page }) => {
  await mockEditar(page);
  await page.goto('/alumnos/editar/101');
  await expect(page.getByRole('heading', { name: 'Editar Alumno #101', exact: true })).toBeVisible();
  await expect(page.locator('#apellido')).toHaveValue('BENAVIDEZ');
  await expect(page.locator('#nombre')).toHaveValue('JOAQUÍN RAMÓN');
  await expect(page.locator('#num_documento')).toHaveValue('49080302');
  await expect(page.locator('#id_tipo_documento')).toHaveValue('1');
  await expect(page.locator('#id_sexo')).toHaveValue('2');

  await page.getByRole('tab', { name: 'escolaridad' }).click();
  await expect(page.locator('#id_anio')).toHaveValue('1');
  await expect(page.locator('#id_division')).toHaveValue('1');
  await expect(page.locator('#id_categoria')).toHaveValue('1');
  await expect(page.locator('#id_cat_monto')).toHaveValue('1');

  await page.getByRole('tab', { name: 'otros' }).click();
  await expect(page.locator('#observaciones')).toHaveValue('OBS ORIGINAL');
});

test('editar alumno valida fecha de ingreso y obligatorios antes del POST', async ({ page }) => {
  const api = await mockEditar(page);
  await page.goto('/alumnos/editar/101');
  await page.locator('#ingreso').fill('');
  await page.getByLabel('Guardar').click();
  await expect(page.getByText(/fecha de ingreso es obligatoria/i)).toBeVisible();
  expect(api.byAction('editar_alumno').filter(c => c.method === 'POST')).toHaveLength(0);
});

test('editar alumno normaliza mayúsculas y conserva id_cat_monto', async ({ page }) => {
  const api = await mockEditar(page);
  await page.goto('/alumnos/editar/101');
  await page.locator('#apellido').fill('benavidez actualizado');
  await page.locator('#localidad').fill('rafaela');
  await page.getByLabel('Guardar').click();
  await expect.poll(() => api.byAction('editar_alumno').filter(c => c.method === 'POST').length).toBe(1);
  const call = api.byAction('editar_alumno').find(c => c.method === 'POST');
  expect(call.data.apellido).toBe('BENAVIDEZ ACTUALIZADO');
  expect(call.data.localidad).toBe('RAFAELA');
  expect(String(call.data.id_cat_monto)).toBe('1');
  expect(call.data.ingreso).toBe('2026-03-01');
});
