const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const { loadTestEnv } = require('./tests/helpers/env.helper');
// Debe ejecutarse ANTES de construir webServer: React toma las variables al arrancar.
const env = loadTestEnv(__dirname);
const frontendURL = new URL(env.baseURL);
const webServer = [];
if (env.local) {
  webServer.push({
    name: 'Cooperadora PHP',
    command: 'node tests/helpers/start-backend.js',
    cwd: __dirname,
    url: `${env.apiBase}/health.php`,
    reuseExistingServer: false,
    timeout: 60000,
    stdout: 'pipe', stderr: 'pipe',
  });
}
webServer.push({
  name: 'Cooperadora React', command: env.frontendCommand, cwd: __dirname,
  url: env.baseURL, reuseExistingServer: false, timeout: 240000,
  env: {
    REACT_APP_API_URL: env.apiBase,
    PORT: frontendURL.port || '80', HOST: frontendURL.hostname,
    BROWSER: 'none', CI: 'true', HTTPS: 'false',
    WDS_SOCKET_PORT: frontendURL.port || '80',
  },
  stdout: 'pipe', stderr: 'pipe',
});

module.exports = defineConfig({
  testDir: './tests', testMatch: '**/*.spec.js',
  fullyParallel: false, workers: 1, retries: 0, forbidOnly: true,
  timeout: 60000, expect: { timeout: 15000 },
  globalSetup: './tests/auth.setup.js', globalTeardown: './tests/auth.teardown.js',
  outputDir: 'test-results',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: env.baseURL, actionTimeout: 15000, navigationTimeout: 60000,
    locale: 'es-AR', timezoneId: 'America/Argentina/Cordoba',
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
    video: 'off', serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer,
});
