const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { loadTestEnv, requireCredentials } = require('./env.helper');

async function busyPort(host, port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const done = busy => { socket.destroy(); resolve(busy); };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(1000, () => done(false));
  });
}
async function main() {
  const env = loadTestEnv();
  const args = process.argv.slice(2);
  const listing = args.includes('--list') || args.includes('--help');
  let cli;
  try {
    const manifest = require.resolve('playwright/package.json');
    cli = path.join(path.dirname(manifest), 'cli.js');
    if (!fs.existsSync(cli)) throw new Error('No existe cli.js dentro del paquete playwright.');
  } catch (error) {
    throw new Error(`No se pudo localizar Playwright (${error.code || error.message}). Instala la dependencia con: npm install --save-dev @playwright/test`);
  }
  if (!listing) {
    requireCredentials(env);
    const urls = [new URL(env.baseURL), ...(env.local ? [new URL(env.apiBase)] : [])];
    for (const url of urls) {
      const port = Number(url.port || 80);
      for (const host of ['127.0.0.1', '::1']) {
        if (await busyPort(host, port)) throw new Error(`Puerto ${port} ocupado. Detené con Ctrl+C el servidor correspondiente antes de correr Cooperadora. No se reutiliza ni se cierra otro proyecto automáticamente.`);
      }
    }
  }
  const authDir = path.join(env.root, 'tests/.auth');
  fs.mkdirSync(authDir, { recursive: true });
  const lock = path.join(authDir, 'runner.lock');
  if (fs.existsSync(lock)) {
    const pid = Number(fs.readFileSync(lock, 'utf8'));
    let live = false;
    if (Number.isInteger(pid) && pid > 0) {
      try { process.kill(pid, 0); live = true; } catch (error) { live = error.code !== 'ESRCH'; }
    }
    if (live) throw new Error(`Hay otra ejecución de este testing activa (PID ${pid}).`);
    fs.rmSync(lock);
  }
  fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
  const cleanup = () => {
    try {
      if (fs.readFileSync(lock, 'utf8') === String(process.pid)) fs.rmSync(lock);
    } catch {}
  };
  process.once('exit', cleanup);
  const hasReporter = args.some(arg => arg === '--reporter' || String(arg).startsWith('--reporter='));
  const reporterArgs = hasReporter
    ? []
    : ['--reporter', path.join(env.root, 'tests/helpers/concise-reporter.js')];
  const child = spawn(process.execPath, [cli, 'test', '--config', path.join(env.root, 'playwright.config.js'), '--project=chromium', '--workers=1', ...reporterArgs, ...args], {
    cwd: env.root, env: process.env, stdio: 'inherit', shell: false,
  });
  child.once('error', error => { cleanup(); console.error(`✗ Testing\n  ${error.message}`); process.exitCode = 1; });
  child.once('exit', code => { cleanup(); process.exitCode = code ?? 1; });
}
main().catch(error => { console.error(`✗ Testing\n  ${error.message}`); process.exitCode = 1; });
