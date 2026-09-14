const fs = require('fs');
const path = require('path');
const { loadTestEnv } = require('./helpers/env.helper');
module.exports = async function teardown() {
  const env = loadTestEnv();
  for (const file of ['user.json', 'environment.json']) fs.rmSync(path.join(env.root, 'tests/.auth', file), { force: true });
  // El login actual devuelve usuario, sin sesión/token del servidor que revocar.
  // Esta suite no crea registros: no hay limpieza SQL ni endpoints E2E de LALCEC.
};
