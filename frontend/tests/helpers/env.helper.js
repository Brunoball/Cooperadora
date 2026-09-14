const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
let cached;

function parseEnv(text) {
  const result = {};
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) throw new Error('Línea inválida en .env.test (se esperaba CLAVE=valor).');
    const key = line.slice(0, index).trim();
    if (Object.hasOwn(result, key)) throw new Error(`Variable repetida en .env.test: ${key}`);
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    result[key] = value;
  }
  return result;
}

function isLocalApi(value) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname);
}

function loadTestEnv(root = ROOT) {
  if (cached) return cached;
  const file = path.join(root, '.env.test');
  if (!fs.existsSync(file)) throw new Error('Falta frontend/.env.test. Copiá .env.test.example como .env.test.');
  const values = parseEnv(fs.readFileSync(file, 'utf8'));
  if (!values.PW_API_URL) throw new Error('Dejá exactamente una PW_API_URL activa en .env.test.');
  // La configuración del archivo gana también para credenciales y comandos.
  Object.assign(process.env, values);
  const api = new URL(values.PW_API_URL);
  const base = new URL(values.PW_BASE_URL || 'http://localhost:3000');
  const local = isLocalApi(api.href);
  if (!isLocalApi(base.href) || base.protocol !== 'http:' || base.pathname !== '/' || base.search || base.hash || base.username || base.password) {
    throw new Error('PW_BASE_URL debe ser el origen HTTP local del frontend, sin ruta ni credenciales.');
  }
  if (api.search || api.hash || api.username || api.password) throw new Error('PW_API_URL no admite query, fragmento ni credenciales.');
  if (local) {
    if (api.protocol !== 'http:' || !/^\/routes(?:\/api\.php)?\/?$/.test(api.pathname)) {
      throw new Error('API local esperada: http://localhost:3001/routes. PHP se ejecuta desde backend/.');
    }
  } else if (api.protocol !== 'https:' || api.hostname !== 'cooperadora.ipet50.edu.ar' || !/^\/api\/routes(?:\/api\.php)?\/?$/.test(api.pathname)) {
    throw new Error('API remota esperada: https://cooperadora.ipet50.edu.ar/api/routes');
  }
  const apiBase = api.href.replace(/\/api\.php\/?$/, '').replace(/\/+$/, '');
  const environment = local ? 'local' : 'hostinger';
  const credentialPrefix = local ? 'PW_LOCAL_' : 'PW_HOSTINGER_';
  process.env.PW_API_URL = apiBase;
  process.env.PW_ENVIRONMENT = environment;
  process.env.PW_USER = (values[credentialPrefix + 'USER'] || '').trim();
  process.env.PW_PASSWORD = values[credentialPrefix + 'PASSWORD'] || '';
  process.env.REACT_APP_API_URL = apiBase;
  process.env.PW_START_FRONTEND = 'true';
  process.env.PW_START_BACKEND = String(local);
  cached = {
    root, apiBase, local, environment, baseURL: base.origin,
    backendDir: path.resolve(root, values.PW_BACKEND_DIR || '../backend'),
    username: process.env.PW_USER, password: process.env.PW_PASSWORD,
    frontendCommand: values.PW_FRONTEND_COMMAND || 'npm start',
    phpBin: values.PW_PHP_BIN || 'php', phpIni: values.PW_PHP_INI || '',
  };
  return cached;
}

function requireCredentials(env = loadTestEnv()) {
  if (!env.username || !env.password) throw new Error(`Completá PW_${env.local ? 'LOCAL' : 'HOSTINGER'}_USER y PW_${env.local ? 'LOCAL' : 'HOSTINGER'}_PASSWORD en frontend/.env.test con una cuenta de Cooperadora.`);
}

module.exports = { ROOT, parseEnv, isLocalApi, loadTestEnv, requireCredentials };
