const { test, expect } = require('./fixtures/auth.fixture');
test.use({ authenticated: false });

const routes = [
  '/panel', '/registro', '/bot/panel',
  '/alumnos', '/alumnos/agregar', '/alumnos/editar/1', '/alumnos/baja',
  '/familias', '/cuotas', '/ventas',
  '/contable', '/contable/libro',
  '/tipos-documentos',
  '/categorias', '/categorias/nueva', '/categorias/editar/1',
];

for (const route of routes) {
  test(`sin sesión ${route} vuelve al login`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Iniciar Sesión', exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Usuario')).toBeVisible();
  });
}

test('ruta inexistente también vuelve al login', async ({ page }) => {
  await page.goto('/ruta-que-no-existe-e2e');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Iniciar Sesión', exact: true })).toBeVisible();
});
