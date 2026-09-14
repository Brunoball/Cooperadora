const { expect } = require('@playwright/test');
const { loadTestEnv } = require('./env.helper');
async function loginThroughUi(page, { password, remember = false } = {}) {
  const env = loadTestEnv();
  await page.goto('/');
  await page.getByPlaceholder('Usuario', { exact: true }).fill(env.username);
  await page.getByPlaceholder('Contraseña', { exact: true }).fill(password ?? env.password);
  await page.getByRole('checkbox', { name: 'Recordar cuenta' }).setChecked(remember);
  await page.getByRole('button', { name: 'Iniciar Sesión', exact: true }).click();
}
async function expectPanel(page) {
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole('heading', { name: 'Panel de gestión', exact: true })).toBeVisible();
}
module.exports = { loginThroughUi, expectPanel };
