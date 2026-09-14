const fs = require('fs');
const path = require('path');
const base = require('@playwright/test');
const { loadTestEnv } = require('../helpers/env.helper');
const { allowedRequest } = require('../helpers/api.helper');
const { botMock } = require('../helpers/bot.helper');

const test = base.test.extend({
  authenticated: [true, { option: true }],
  storageState: async ({ authenticated }, use) => {
    if (!authenticated) return use({ cookies: [], origins: [] });
    const env = loadTestEnv();
    const saved = JSON.parse(fs.readFileSync(path.join(env.root, 'tests/.auth/environment.json'), 'utf8'));
    if (saved.apiBase !== env.apiBase || saved.baseURL !== env.baseURL) throw new Error('La sesión pertenece a otra configuración. Volvé a ejecutar la suite.');
    const session = JSON.parse(fs.readFileSync(path.join(env.root, 'tests/.auth/user.json'), 'utf8'));
    const localStorage = [{ name: 'usuario', value: JSON.stringify(session.usuario) }];
    if (session.token) localStorage.push({ name: 'token', value: session.token });
    await use({ cookies: [], origins: [{ origin: env.baseURL, localStorage }] });
  },
  context: async ({ context }, use, testInfo) => {
    const env = loadTestEnv();
    const endpoint = new URL(`${env.apiBase}/api.php`);
    const failures = [];
    const pending = new Set();
    const monitored = url => url.origin === endpoint.origin && url.pathname === endpoint.pathname;
    await context.route('**/*', async route => {
      const req = route.request();
      const url = new URL(req.url());
      const mock = botMock(url);
      if (mock) {
        if (!mock.body || req.method() !== 'GET') {
          failures.push(`Endpoint de bot sin simulación: ${req.method()} ${mock.file}`);
          return route.abort('blockedbyclient');
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mock.body) });
      }
      if (monitored(url)) {
        const action = url.searchParams.get('action') || '';
        if (!allowedRequest(action, req.method(), url.searchParams)) {
          failures.push(`Mutación o acción fuera del alcance de esta suite: ${req.method()} ${action}`);
          return route.abort('blockedbyclient');
        }
      } else if (url.pathname.endsWith('.php')) {
        failures.push(`API inesperada: ${url.origin}${url.pathname}. Revisá REACT_APP_API_URL.`);
        return route.abort('blockedbyclient');
      }
      await route.continue();
    });
    context.on('page', page => page.on('pageerror', error => failures.push(`JavaScript: ${error.message}`)));
    context.on('requestfailed', req => {
      const url = new URL(req.url());
      if (monitored(url) && !/ERR_ABORTED|NS_BINDING_ABORTED/.test(req.failure()?.errorText || '')) failures.push(`Red: ${url.searchParams.get('action')} (${req.failure()?.errorText})`);
    });
    context.on('response', response => {
      const url = new URL(response.url());
      if (!monitored(url)) return;
      const task = (async () => {
        const action = url.searchParams.get('action');
        const headers = response.headers();

        // Las respuestas simuladas pertenecen al propio test funcional. No deben
        // ser reinterpretadas por el monitor global como fallos del backend real.
        if (headers['x-e2e-mock'] === '1') return;

        if (response.status() >= 400) {
          failures.push(`HTTP ${response.status()} en ${action}`);
          return;
        }
        if (response.request().method() === 'OPTIONS') return;

        const contentType = String(headers['content-type'] || '').toLowerCase();
        if (!contentType.includes('json')) {
          failures.push(`Respuesta no JSON en ${action}`);
          return;
        }

        let body;
        try {
          body = await response.json();
        } catch {
          // Si una navegación destruye el body después de recibir headers JSON,
          // no es un error funcional. Los fallos reales de red ya los captura
          // requestfailed y los HTTP >= 400 se validan arriba.
          return;
        }
        if (action !== 'inicio' && (body?.exito === false || body?.error)) failures.push(`La API devolvió error funcional en ${action}: ${body?.mensaje || 'sin mensaje'}`);
      })();
      pending.add(task);
      task.finally(() => pending.delete(task));
    });
    await use(context);
    await Promise.allSettled([...pending]);
    if (failures.length) {
      await testInfo.attach('fallos-tecnicos.txt', { body: Buffer.from([...new Set(failures)].join('\n')), contentType: 'text/plain' });
      if (!testInfo.errors.length) throw new Error([...new Set(failures)].join('\n'));
    }
  },
});
module.exports = { test, expect: base.expect };
