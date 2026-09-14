const { test, expect } = require('./fixtures/auth.fixture');
const { loginThroughUi, expectPanel } = require('./helpers/auth.helper');
const { loadTestEnv } = require('./helpers/env.helper');
test.use({ authenticated: false });

test('login muestra formulario de Cooperadora', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('img', { name: 'Cooperadora IPET 50' })).toBeVisible();
  await expect(page.getByPlaceholder('Usuario')).toBeVisible();
  await expect(page.getByPlaceholder('Contraseña')).toHaveAttribute('type', 'password');
});
test('login valida campos vacíos', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Iniciar Sesión', exact: true }).click();
  await expect(page.getByText('Por favor complete todos los campos', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(`${loadTestEnv().baseURL}/`);
});
test('login muestra y oculta la contraseña', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click();
  await expect(page.getByPlaceholder('Contraseña')).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ocultar contraseña', exact: true }).click();
  await expect(page.getByPlaceholder('Contraseña')).toHaveAttribute('type', 'password');
});
test('login rechaza contraseña incorrecta para la cuenta existente', async ({ page }) => {
  await loginThroughUi(page, { password: loadTestEnv().password + '_PW_INVALIDA_' });
  await expect(page.getByText('Credenciales incorrectas.', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Usuario')).toBeVisible();
});
test('login real ingresa y conserva sesión al recargar', async ({ page }) => {
  await loginThroughUi(page);
  await expectPanel(page);
  await page.reload();
  await expectPanel(page);
});
test('recordar cuenta restaura el usuario y la contraseña', async ({ page }) => {
  await loginThroughUi(page, { remember: true });
  await expectPanel(page);
  await page.goto('/');
  await expect(page.getByRole('checkbox', { name: 'Recordar cuenta' })).toBeChecked();
  await expect(page.getByPlaceholder('Usuario')).toHaveValue(loadTestEnv().username);
  // Comparación booleana para no imprimir la contraseña si falla.
  expect(await page.getByPlaceholder('Contraseña').inputValue() === loadTestEnv().password).toBe(true);
});
test('cerrar sesión vuelve al login y bloquea el panel', async ({ page }) => {
  await loginThroughUi(page);
  await expectPanel(page);
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Confirmar cierre de sesión' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByPlaceholder('Usuario')).toBeVisible();
  await page.goto('/panel');
  await expect(page.getByRole('heading', { name: 'Iniciar Sesión', exact: true })).toBeVisible();
});
