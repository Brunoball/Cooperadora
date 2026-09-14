const { test, expect } = require('./fixtures/auth.fixture');
const { installApiMock } = require('./helpers/mock-api.helper');
test('categorías exige nombre antes de guardar', async ({ page }) => {
  await page.goto('/categorias/nueva');
  // Espacio pasa required del navegador, pero debe rechazarse al normalizar.
  await page.getByPlaceholder('Ej: "A"', { exact: true }).fill(' ');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('El nombre de la categoría es obligatorio', { exact: true })).toBeVisible();
});
test('documentos exige descripción', async ({ page }) => {
  await page.goto('/tipos-documentos');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText('La descripción es obligatoria.', { exact: true })).toBeVisible();
});
test('documentos exige sigla', async ({ page }) => {
  await page.goto('/tipos-documentos');
  await page.getByPlaceholder('(ej: Documento Nacional de Identidad)', { exact: true }).fill('PW E2E DOCUMENTO');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText('La sigla es obligatoria.', { exact: true })).toBeVisible();
});
test('documentos limita sigla a diez caracteres', async ({ page }) => {
  await page.goto('/tipos-documentos');
  const input = page.getByPlaceholder('(ej: DNI)', { exact: true });
  await expect(input).toHaveAttribute('maxlength', '10');
  await input.fill('ABCDEFGHIJKLM');
  await expect(input).toHaveValue('ABCDEFGHIJ');
});
test('registro exige campos completos', async ({ page }) => {
  await page.goto('/registro');
  await page.locator('button[type="submit"]').click();
  expect(await page.getByPlaceholder('Usuario', { exact: true }).evaluate(input => input.validity.valueMissing)).toBe(true);
  await expect(page).toHaveURL(/\/registro$/);
});
test('registro rechaza contraseñas que no coinciden', async ({ page }) => {
  await page.goto('/registro');
  await page.getByPlaceholder('Usuario', { exact: true }).fill('PW_E2E_SIN_ALTA');
  await page.getByRole('combobox').selectOption('admin');
  await page.getByPlaceholder('Contraseña', { exact: true }).fill('PW_E2E_123');
  await page.getByPlaceholder('Confirmar Contraseña', { exact: true }).fill('PW_E2E_456');
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText('Las contraseñas no coinciden.', { exact: true })).toBeVisible();
});


test('registro completo envía usuario, rol y contraseña al backend', async ({ page }) => {
  const api = await installApiMock(page, {
    registro: ({ data }) => ({ exito: true, usuario: { idUsuario: 999, nombre: data.nombre, rol: data.rol } }),
  });
  await page.goto('/registro');
  await page.getByPlaceholder('Usuario', { exact: true }).fill('PW_E2E_ADMIN');
  await page.getByRole('combobox').selectOption('admin');
  await page.getByPlaceholder('Contraseña', { exact: true }).fill('PW_E2E_123');
  await page.getByPlaceholder('Confirmar Contraseña', { exact: true }).fill('PW_E2E_123');
  await page.getByRole('button', { name: 'Registrarse', exact: true }).click();
  await expect.poll(() => api.byAction('registro').length).toBe(1);
  const payload = api.last('registro').data;
  expect(payload.nombre).toBe('PW_E2E_ADMIN');
  expect(payload.rol).toBe('admin');
  expect(payload.contrasena).toBe('PW_E2E_123');
});
