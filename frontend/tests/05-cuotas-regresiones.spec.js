const { test, expect } = require('@playwright/test');
const { apiCall } = require('./helpers/api.helper');
for (const month of [1, 2]) {
  test(`cuotas no habilita mes escolar ${month}`, async ({ request }) => {
    const body = await apiCall(request, 'cuotas', { params: { id_mes: month } });
    expect(body.exito).toBe(true);
    expect(body.cuotas).toEqual([]);
    expect(body.mensaje).toContain('Enero y febrero');
  });
}
test('cuotas aplica filtro de cobrador', async ({ request }) => {
  const body = await apiCall(request, 'cuotas', { params: { solo_cobrador: 1 } });
  expect(body.solo_cobrador).toBe(1);
  expect(Array.isArray(body.cuotas)).toBe(true);
});
for (const filter of ['pagados', 'condonados']) {
  test(`cuotas permite consultar ${filter}`, async ({ request }) => {
    const body = await apiCall(request, 'cuotas', { params: { [filter]: 1, id_mes: 3 } });
    expect(body.exito).toBe(true);
    expect(Array.isArray(body.cuotas)).toBe(true);
  });
}
