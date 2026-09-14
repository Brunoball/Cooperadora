const { test, expect } = require('./fixtures/auth.fixture');
const { installApiMock, DEFAULT_LISTAS } = require('./helpers/mock-api.helper');

const alumnos = [
  {
    id_alumno: 101, apellido: 'BENAVIDEZ', nombre: 'JOAQUÍN RAMÓN',
    dni: '49080302', num_documento: '49080302', domicilio: 'CALLE TEST 123', localidad: 'CÓRDOBA',
    id_anio: 1, id_año: 1, anio_nombre: '1°', id_division: 1, division_nombre: 'A',
    id_categoria: 1, categoria_nombre: 'EXTERNO', id_cat_monto: 1,
    id_tipo_documento: 1, tipo_documento: 'DNI', id_sexo: 2, sexo: 'M',
    telefono: '3510000000', observaciones: 'ALUMNO E2E', es_cobrador: 0,
  },
  {
    id_alumno: 102, apellido: 'PÉREZ', nombre: 'ANA',
    dni: '50000000', num_documento: '50000000', domicilio: 'OTRA 456', localidad: 'CÓRDOBA',
    id_anio: 1, id_año: 1, anio_nombre: '1°', id_division: 1, division_nombre: 'A',
    id_categoria: 1, categoria_nombre: 'EXTERNO', id_cat_monto: 1,
    id_tipo_documento: 1, tipo_documento: 'DNI', id_sexo: 1, sexo: 'F', es_cobrador: 1,
  },
];


async function mostrarTodos(page) {
  const boton = page.getByRole('button', { name: /Mostrar todos los alumnos/i });
  if (await boton.isVisible().catch(() => false)) await boton.click();
  await expect(page.locator('.alu-row').first()).toBeVisible();
}

async function seleccionarAlumno(page, texto = 'BENAVIDEZ JOAQUÍN RAMÓN') {
  await mostrarTodos(page);
  const fila = page.locator('.alu-row').filter({ hasText: texto }).first();
  await expect(fila).toBeVisible();
  // La lista aplica una animación/cortina antes de aceptar la selección.
  await page.waitForTimeout(1250);
  await fila.click();
}

async function mockAlumnos(page, extra = {}) {
  return installApiMock(page, {
    alumnos: ({ url }) => {
      const id = Number(url.searchParams.get('id') || 0);
      return { exito: true, alumnos: id ? alumnos.filter(a => a.id_alumno === id) : alumnos };
    },
    obtener_listas: { exito: true, listas: DEFAULT_LISTAS },
    toggle_cobrador: ({ data }) => ({ exito: true, es_cobrador: Number(data?.valor ?? 1) }),
    eliminar_alumno: { exito: true, mensaje: 'Alumno eliminado' },
    dar_baja_alumno: { exito: true, mensaje: 'Alumno dado de baja' },
    agregar_alumno: { exito: true, mensaje: 'Alumno agregado' },
    familias_listar: { exito: true, familias: [] },
    alumnos_baja: { exito: true, alumnos: [] },
    editar_alumno: ({ request }) => request.method() === 'GET'
      ? { exito: true, alumno: alumnos[0], ...alumnos[0] }
      : { exito: true, mensaje: 'Alumno actualizado' },
    ...extra,
  }, { strict: true });
}

test('alumnos busca por nombre/DNI y limpia filtros', async ({ page }) => {
  await mockAlumnos(page);
  await page.goto('/alumnos');
  const search = page.getByPlaceholder('Buscar por apellido, nombre o DNI');

  await search.fill('joaquin');
  await expect(page.getByText('BENAVIDEZ JOAQUÍN RAMÓN', { exact: true })).toBeVisible();
  await expect(page.getByText('PÉREZ ANA', { exact: true })).toHaveCount(0);

  await search.fill('50000000');
  await expect(page.getByText('PÉREZ ANA', { exact: true })).toBeVisible();
  await expect(page.getByText('BENAVIDEZ JOAQUÍN RAMÓN', { exact: true })).toHaveCount(0);

  await search.fill('');
  await expect(page.getByText(/Por favor aplicá búsqueda o filtros/i)).toBeVisible();
  await page.getByRole('button', { name: /Mostrar todos los alumnos/i }).click();
  await expect(page.getByText('BENAVIDEZ JOAQUÍN RAMÓN', { exact: true })).toBeVisible();
  await expect(page.getByText('PÉREZ ANA', { exact: true })).toBeVisible();
});

test('alumnos abre información completa y sus pestañas', async ({ page }) => {
  await mockAlumnos(page);
  await page.goto('/alumnos');
  await seleccionarAlumno(page);
  await page.getByLabel('Ver información').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Información del Alumno' })).toBeVisible();
  for (const tab of ['Datos Generales', 'Contacto', 'Académico', 'Observaciones']) {
    await dialog.getByRole('button', { name: tab, exact: true }).click();
  }
  await expect(dialog).toContainText('ALUMNO E2E');
  await dialog.getByLabel('Cerrar').click();
  await expect(dialog).toHaveCount(0);
});

test('alumnos permite marcar cobrador con confirmación', async ({ page }) => {
  const api = await mockAlumnos(page);
  await page.goto('/alumnos');
  await seleccionarAlumno(page);
  await page.getByLabel('Cobrador').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Asignar cobrador a domicilio');
  await dialog.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect.poll(() => api.byAction('toggle_cobrador').length).toBe(1);
});

test('eliminar alumno puede cancelarse sin tocar backend', async ({ page }) => {
  const api = await mockAlumnos(page);
  await page.goto('/alumnos');
  await seleccionarAlumno(page);
  await page.getByLabel('Eliminar').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Eliminar permanentemente');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(api.byAction('eliminar_alumno')).toHaveLength(0);
});

test('dar de baja exige motivo y confirma una sola mutación', async ({ page }) => {
  const api = await mockAlumnos(page);
  await page.goto('/alumnos');
  await seleccionarAlumno(page);
  await page.getByLabel('Dar de baja').click();
  const dialog = page.getByRole('dialog');
  const confirmar = dialog.getByRole('button', { name: /Dar de baja|Confirmar/i });

  // El flujo actual valida al hacer click: el botón permanece habilitado, pero
  // sin motivo muestra el error y no dispara ninguna mutación.
  await expect(confirmar).toBeEnabled();
  await confirmar.click();
  await expect(dialog.getByText('Por favor, escribí el motivo de la baja.', { exact: true })).toBeVisible();
  expect(api.byAction('dar_baja_alumno')).toHaveLength(0);

  await dialog.getByPlaceholder('Escribí el motivo (obligatorio)').fill('Cambio de institución');
  await expect(dialog.getByText('Por favor, escribí el motivo de la baja.', { exact: true })).toHaveCount(0);
  await confirmar.click();
  await expect.poll(() => api.byAction('dar_baja_alumno').length).toBe(1);
});

test('acciones principales navegan a agregar, familias y bajas', async ({ page }) => {
  await mockAlumnos(page);
  await page.goto('/alumnos');
  await page.getByLabel('Agregar').click();
  await expect(page).toHaveURL(/\/alumnos\/agregar$/);
  await expect(page.locator('[name="apellido"]')).toBeVisible();

  await page.goto('/alumnos');
  await page.getByLabel('Familias').click();
  await expect(page).toHaveURL(/\/familias$/);
  await expect(page.getByRole('heading', { name: 'Gestión de familia', exact: true })).toBeVisible();

  await page.goto('/alumnos');
  await page.getByLabel('Dados de Baja').click();
  await expect(page).toHaveURL(/\/alumnos\/baja$/);
  await expect(page.getByRole('heading', { name: 'Alumnos Dados de Baja', exact: true })).toBeVisible();
});

test('agregar alumno recorre el wizard y no envía datos incompletos', async ({ page }) => {
  const api = await mockAlumnos(page);
  await page.goto('/alumnos/agregar');

  for (const name of ['apellido', 'nombre', 'id_tipo_documento', 'num_documento', 'id_sexo']) {
    await expect(page.locator(`[name="${name}"]`)).toBeVisible();
  }
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.locator('[name="apellido"]')).toBeVisible();
  expect(api.byAction('agregar_alumno')).toHaveLength(0);

  await page.locator('[name="apellido"]').fill('TEST');
  await page.locator('[name="nombre"]').fill('ALUMNO');
  await page.locator('[name="id_tipo_documento"]').selectOption('1');
  await page.locator('[name="num_documento"]').fill('49999999');
  await page.locator('[name="id_sexo"]').selectOption('2');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();

  await expect(page.locator('[name="domicilio"]')).toBeVisible();
  await page.locator('[name="domicilio"]').fill('CALLE TEST 123');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();

  for (const name of ['id_año', 'id_division', 'id_categoria', 'id_cat_monto']) {
    await expect(page.locator(`[name="${name}"]`)).toBeVisible();
  }
  await page.getByRole('button', { name: /Guardar Alumno/i }).click();
  expect(api.byAction('agregar_alumno')).toHaveLength(0);
});


test('eliminar alumno confirma una sola eliminación real', async ({ page }) => {
  const api = await mockAlumnos(page);
  await page.goto('/alumnos');
  await seleccionarAlumno(page);
  await page.getByLabel('Eliminar').click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Eliminar permanentemente' });
  await dialog.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect.poll(() => api.byAction('eliminar_alumno').length).toBe(1);
  expect(Number(api.last('eliminar_alumno').data.id_alumno)).toBe(101);
});

test('agregar alumno completo envía todos los campos obligatorios', async ({ page }) => {
  const api = await mockAlumnos(page);
  await page.goto('/alumnos/agregar');
  await page.locator('[name="apellido"]').fill('PRUEBA');
  await page.locator('[name="nombre"]').fill('ALUMNO');
  await page.locator('[name="id_tipo_documento"]').selectOption('1');
  await page.locator('[name="num_documento"]').fill('49999998');
  await page.locator('[name="id_sexo"]').selectOption('2');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await page.locator('[name="domicilio"]').fill('CALLE TEST 123');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await page.locator('[name="id_año"]').selectOption('1');
  await page.locator('[name="id_division"]').selectOption('1');
  await page.locator('[name="id_categoria"]').selectOption('1');
  await page.locator('[name="id_cat_monto"]').selectOption('1');
  await page.getByRole('button', { name: /Guardar Alumno/i }).click();
  await expect.poll(() => api.byAction('agregar_alumno').length).toBe(1);
  const payload = api.last('agregar_alumno').data;
  expect(payload.apellido).toBe('PRUEBA');
  expect(payload.nombre).toBe('ALUMNO');
  expect(String(payload.id_cat_monto)).toBe('1');
});
