const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const { loadTestEnv } = require('./helpers/env.helper');
const { READ_ACTIONS } = require('./helpers/api.helper');

function walk(dir, extensions = null) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, extensions));
    else if (!extensions || extensions.includes(path.extname(entry.name))) out.push(p);
  }
  return out;
}

function frontendActions(srcDir, { excludeBotPanel = false } = {}) {
  const actions = new Set();
  for (const file of walk(srcDir, ['.js', '.jsx'])) {
    const normalized = file.split(path.sep).join('/');
    if (excludeBotPanel && normalized.includes('/components/BotPanel/')) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const re of [
      /action=([A-Za-z0-9_]+)/g,
      /(?:set|append)\(\s*['"]action['"]\s*,\s*['"]([^'"]+)['"]/g,
      /\brequest\(\s*['"]([^'"]+)['"]/g,
      /\bapi\(\s*['"]([^'"]+)['"]\s*\)/g,
    ]) {
      let m;
      while ((m = re.exec(text))) actions.add(m[1]);
    }
  }
  return actions;
}

function backendActions(backendDir) {
  const actions = new Set();
  for (const file of walk(path.join(backendDir, 'modules'), ['.php'])) {
    if (path.basename(file) !== 'route.php') continue;
    const text = fs.readFileSync(file, 'utf8');
    let m;
    const re = /case\s+['"]([^'"]+)['"]/g;
    while ((m = re.exec(text))) actions.add(m[1]);
  }
  return actions;
}

test('todas las acciones usadas por el frontend tienen ruta backend', async () => {
  const env = loadTestEnv();
  const front = frontendActions(path.join(env.root, 'src'), { excludeBotPanel: true });
  const back = backendActions(env.backendDir);

  // ModalCodigoBarras quedó montado como legado pero no tiene apertura desde Cuotas.
  // Si vuelve a habilitarse, este test obliga a crear/restaurar su endpoint antes.
  const legacyNoRuteado = new Set(['buscar_socio_codigo']);
  const faltantes = [...front].filter(a => !back.has(a) && !legacyNoRuteado.has(a)).sort();
  expect(faltantes, `Acciones frontend sin case backend: ${faltantes.join(', ')}`).toEqual([]);

  expect(front.has('registrar_pago')).toBe(true);
  expect(front.has('obtener_monto_categoria')).toBe(true);
  expect(front.has('cat_actualizar')).toBe(true);
  expect(front.has('ventas_orden_guardar')).toBe(true);
  expect(front.has('contable_egresos')).toBe(true);
});

test('el endpoint legado buscar_socio_codigo sigue inaccesible desde la UI', async () => {
  const env = loadTestEnv();
  const cuotas = fs.readFileSync(path.join(env.root, 'src/components/Cuotas/Cuotas.jsx'), 'utf8');
  const modal = fs.readFileSync(path.join(env.root, 'src/components/Cuotas/modales/ModalCodigoBarras.jsx'), 'utf8');
  expect(modal).toContain('buscar_socio_codigo');
  expect(cuotas).not.toMatch(/setMostrarModalCodigoBarras\(true\)/);
});

test('edición de categorías conserva centavos para reglas familiares', async () => {
  const env = loadTestEnv();
  const front = fs.readFileSync(path.join(env.root, 'src/components/Categorias/CategoriaEditar.jsx'), 'utf8');
  const back = fs.readFileSync(path.join(env.backendDir, 'modules/categorias/editar_categoria.php'), 'utf8');
  expect((front.match(/step="0\.01"/g) || []).length).toBeGreaterThanOrEqual(2);
  expect(back).toMatch(/toDecOrNull/);
  expect(back).toMatch(/monto_mensual/);
  expect(back).toMatch(/monto_anual/);
});

test('pago familiar mantiene redondeo final y reparto exacto en pesos', async () => {
  const env = loadTestEnv();
  const front = fs.readFileSync(path.join(env.root, 'src/components/Cuotas/modales/ModalPagos.jsx'), 'utf8');
  const back = fs.readFileSync(path.join(env.backendDir, 'modules/cuotas/registrar_pago.php'), 'utf8');
  expect(front).toMatch(/roundToPeso/);
  expect(front).toMatch(/roundToPeso\(\(Number\(total\) \|\| 0\) \* n\)/);
  expect(back).toContain('redondeo_grupo_aplicado');
  expect(back).toContain('asignaciones_grupo_por_periodo');
  expect(back).toMatch(/intdiv\s*\(/);
});

test('monto de categoría conserva histórico mensual y anual por año', async () => {
  const env = loadTestEnv();
  const back = fs.readFileSync(path.join(env.backendDir, 'modules/cuotas/obtener_monto_categoria.php'), 'utf8');
  expect(back).toContain('montos_por_periodo');
  expect(back).toContain('cargar_historial');
  expect(back).toContain('precio_en_fecha');
  expect(back).toContain('precio_anual_en_anio');
});



test('todas las acciones alcanzables fuera de BotPanel tienen un test funcional', async () => {
  const env = loadTestEnv();
  const front = frontendActions(path.join(env.root, 'src'), { excludeBotPanel: true });

  // Este modal existe en código pero no puede abrirse desde Cuotas. No es una acción alcanzable del sistema actual.
  const legacyNoAlcanzable = new Set(['buscar_socio_codigo']);

  // No contamos este archivo de inventario como cobertura: la acción tiene que aparecer
  // en otro spec que efectivamente recorra UI o consulte la API. También excluimos BotPanel.
  const funcionales = walk(path.join(env.root, 'tests'), ['.js'])
    .filter(file => file.endsWith('.spec.js'))
    .filter(file => path.basename(file) !== '16-contrato-frontend-backend.spec.js')
    .filter(file => path.basename(file) !== '07-panel-bot.spec.js');
  const corpus = funcionales.map(file => fs.readFileSync(file, 'utf8')).join('\n');

  const sinTest = [...front]
    .filter(action => !legacyNoAlcanzable.has(action))
    .filter(action => !corpus.includes(action))
    .sort();

  expect(sinTest, `Acciones alcanzables sin test funcional: ${sinTest.join(', ')}`).toEqual([]);
});

test('la cobertura total declarada ignora BotPanel y no oculta acciones nuevas', async () => {
  const env = loadTestEnv();
  const all = frontendActions(path.join(env.root, 'src'));
  const sinBot = frontendActions(path.join(env.root, 'src'), { excludeBotPanel: true });
  expect(sinBot.size).toBeGreaterThan(50);
  expect(sinBot.size).toBeLessThanOrEqual(all.size);
  expect(sinBot.has('registrar_pago')).toBe(true);
  expect(sinBot.has('contable_egresos_upload')).toBe(true);
  expect(sinBot.has('familias_exportar_excel')).toBe(true);
  expect(sinBot.has('ventas_planillas_cursos')).toBe(true);
  expect(sinBot.has('obtener_socio_comprobante')).toBe(true);
  expect(sinBot.has('eliminar_ingresos')).toBe(true);
});

test('todos los PHP del backend compilan en entorno local', async () => {
  const env = loadTestEnv();
  test.skip(!env.local, 'El lint PHP se ejecuta al probar el backend local.');
  const files = walk(env.backendDir, ['.php']);
  expect(files.length).toBeGreaterThan(20);
  const errores = [];
  for (const file of files) {
    const args = [];
    if (env.phpIni) args.push('-c', env.phpIni);
    args.push('-l', file);
    const result = spawnSync(env.phpBin, args, { encoding: 'utf8' });
    if (result.status !== 0) errores.push(`${path.relative(env.backendDir, file)}: ${(result.stderr || result.stdout || '').trim()}`);
  }
  expect(errores, errores.join('\n')).toEqual([]);
});
