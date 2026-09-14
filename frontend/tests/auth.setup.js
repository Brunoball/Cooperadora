const fs = require('fs');
const path = require('path');
const { request } = require('@playwright/test');
const { loadTestEnv, requireCredentials } = require('./helpers/env.helper');
const { parseResponse, createApiSession, apiCall } = require('./helpers/api.helper');
module.exports = async function setup() {
  const env = loadTestEnv();
  const dir = path.join(env.root, 'tests/.auth');
  fs.mkdirSync(dir, { recursive: true });
  for (const file of ['user.json', 'environment.json']) fs.rmSync(path.join(dir, file), { force: true });
  requireCredentials(env);
  const api = await request.newContext({ timeout: 45000 });
  try {
    if (env.local) {
      const response = await api.get(`${env.apiBase}/testing_health.php`, { maxRedirects: 0 });
      if (response.status() === 404) throw new Error('Falta backend/routes/testing_health.php: copiá también la carpeta backend del ZIP.');
      const body = await parseResponse(response);
      if (!response.ok() || body.application !== 'cooperadora' || body.database_connected !== true) {
        throw new Error(`El diagnóstico de Cooperadora falló: ${body.mensaje || 'API o DB incorrecta.'}`);
      }
    }
    const session = await createApiSession(api, env.username, env.password);
    if (String(session.usuario.rol).toLowerCase() !== 'admin') throw new Error('Configurá una cuenta administradora para recorrer todos los módulos.');
    const lists = await apiCall(api, 'obtener_listas');
    if (!lists.exito || !Array.isArray(lists.listas?.anios) || !Array.isArray(lists.listas?.divisiones)) throw new Error('La API no devolvió los catálogos esperados de Cooperadora.');
    fs.writeFileSync(path.join(dir, 'user.json'), JSON.stringify(session), { mode: 0o600 });
    fs.writeFileSync(path.join(dir, 'environment.json'), JSON.stringify({ apiBase: env.apiBase, baseURL: env.baseURL }));
  } finally { await api.dispose(); }
};
