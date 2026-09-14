const fs = require('fs');
const path = require('path');
const { ROOT } = require('./env.helper');
const file = path.join(ROOT, 'package.json');
const original = fs.readFileSync(file, 'utf8');
const pkg = JSON.parse(original.replace(/^\uFEFF/, ''));
pkg.scripts ||= {};
Object.assign(pkg.scripts, {
  'test:e2e': 'node tests/helpers/run-testing.js',
  'test:e2e:headed': 'node tests/helpers/run-testing.js --headed',
  'test:e2e:ui': 'node tests/helpers/run-testing.js --ui',
  'test:e2e:list': 'node tests/helpers/run-testing.js --list',
  'test:e2e:report': 'playwright show-report',
});
const next = JSON.stringify(pkg, null, 2) + '\n';
if (next !== original) {
  fs.writeFileSync(path.join(ROOT, 'package.json.before-e2e.bak'), original);
  fs.writeFileSync(file, next);
}
const ignoreFile = path.join(ROOT, '.gitignore');
const current = fs.existsSync(ignoreFile) ? fs.readFileSync(ignoreFile, 'utf8') : '';
const entries = ['/.env.test', '/tests/.auth/*', '!/tests/.auth/.gitkeep', '/test-results/', '/playwright-report/', '/blob-report/', '/package.json.before-e2e.bak'];
const lines = new Set(current.split(/\r?\n/));
const missing = entries.filter(line => !lines.has(line));
if (missing.length) fs.appendFileSync(ignoreFile, '\n# Playwright Cooperadora\n' + missing.join('\n') + '\n');
console.log('Comandos test:e2e registrados y archivos privados agregados a .gitignore.');
