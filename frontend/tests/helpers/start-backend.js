const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

// Cooperadora usa la configuracion de backend/config/db.php, como al abrir
// el sistema normalmente. La suite actual es de consultas y validaciones.
// Estas variables pertenecian al testing anterior con una DB separada.
const LEGACY_DATABASE_KEYS = new Set([
  'COOP_DB_HOST', 'COOP_DB_PORT', 'COOP_DB_NAME',
  'COOP_DB_USER', 'COOP_DB_PASS', 'COOP_TEST_MODE',
]);

function buildBackendEnvironment(source) {
  const backendEnv = { ...source };
  for (const key of Object.keys(backendEnv)) {
    if (LEGACY_DATABASE_KEYS.has(key.toUpperCase())) delete backendEnv[key];
  }
  return backendEnv;
}

function startBackend(env, sourceEnvironment = process.env) {
  if (!env.local) throw new Error('El servidor PHP solo se inicia para una API local.');
  if (!fs.existsSync(path.join(env.backendDir, 'routes/api.php'))) {
    throw new Error('PW_BACKEND_DIR no contiene routes/api.php.');
  }
  if (!fs.existsSync(path.join(env.backendDir, 'config/db.php'))) {
    throw new Error('No existe backend/config/db.php en PW_BACKEND_DIR.');
  }
  const api = new URL(env.apiBase);
  const iniArgs = env.phpIni ? ['-c', env.phpIni] : [];
  if (env.phpIni && !fs.existsSync(env.phpIni)) {
    throw new Error('No existe PW_PHP_INI. Corregi esa ruta o dejala vacia.');
  }

  // Copia exclusiva del proceso PHP: no modifica PowerShell, Windows ni .env.test.
  // Al no recibir COOP_DB_* ni el modo antiguo, db.php usa sus propios valores.
  const backendEnv = buildBackendEnvironment(sourceEnvironment);
  const probe = spawnSync(env.phpBin, [...iniArgs, '-r',
    "exit(extension_loaded('pdo_mysql') && extension_loaded('mbstring') ? 0 : 2);"],
  { encoding: 'utf8', env: backendEnv });
  if (probe.error) throw new Error('No se encontro PHP. Corregi PW_PHP_BIN en .env.test.');
  if (probe.status !== 0) {
    throw new Error('PHP necesita pdo_mysql y mbstring. Revisa PW_PHP_INI.');
  }

  const child = spawn(env.phpBin, [...iniArgs, '-S', `${api.hostname}:${api.port || '80'}`], {
    cwd: env.backendDir, env: backendEnv, stdio: ['ignore', 'ignore', 'ignore'], shell: false,
  });
  child.on('error', () => { console.error('✗ Backend local\n  No se pudo iniciar PHP.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  return child;
}

if (require.main === module) {
  try {
    const { loadTestEnv } = require('./env.helper');
    startBackend(loadTestEnv());
  } catch (error) {
    console.error(`✗ Backend local\n  ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { buildBackendEnvironment, startBackend };
