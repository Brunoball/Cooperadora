const { test, expect } = require('./fixtures/auth.fixture');
const routes = [
  ['/panel', 'Panel de gestión'], ['/alumnos', null],
  ['/alumnos/agregar', 'Agregar Nuevo Alumno'], ['/alumnos/baja', 'Alumnos Dados de Baja'],
  ['/familias', 'Gestión de familia'], ['/cuotas', 'Gestión de Cuotas'],
  ['/contable/libro', 'Contable'], ['/categorias', 'Categorías'],
  ['/categorias/nueva', 'Nueva categoría'], ['/tipos-documentos', 'Tipos de Documento'],
  ['/ventas', 'Ventas escolares'], ['/registro', 'Crear Cuenta'],
];
const initialActions = {
  '/alumnos': 'alumnos', '/alumnos/agregar': 'obtener_listas',
  '/alumnos/baja': 'alumnos_baja', '/familias': 'familias_listar',
  '/cuotas': 'cuotas', '/categorias': 'cat_listar',
  '/tipos-documentos': 'td_listar', '/ventas': 'ventas_dashboard',
};
for (const [route, heading] of routes) {
  test(`abre ${route} con sesión real`, async ({ page }) => {
    const expectedAction = initialActions[route];
    const responsePromise = expectedAction ? page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.searchParams.get('action') === expectedAction && response.request().method() === 'GET';
    }) : null;
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    if (heading) await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    else await expect(page.getByPlaceholder('Buscar por apellido, nombre o DNI')).toBeVisible();
    if (responsePromise) {
      const response = await responsePromise;
      expect(response.ok(), expectedAction).toBe(true);
      const body = await response.json();
      expect(body?.exito, expectedAction).not.toBe(false);
      expect(Boolean(body?.error), expectedAction).toBe(false);
    }
  });
}
test('ruta contable redirige al libro', async ({ page }) => {
  await page.goto('/contable');
  await expect(page).toHaveURL(/\/contable\/libro$/);
  await expect(page.getByRole('heading', { name: 'Contable', exact: true })).toBeVisible();
});
