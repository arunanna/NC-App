const { defineConfig } = require('@playwright/test');

const port = Number(process.env.E2E_PORT || 8095);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('E2E_PORT must be a local development port.');
const baseURL = `http://127.0.0.1:${port}`;

module.exports = defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 60000,
  expect: { timeout: 10000 },
  use: { baseURL, browserName: 'chromium', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'phone', use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: `npm start -- --host localhost --port ${port}`,
    env: { CI: '1', EXPO_NO_TELEMETRY: '1', EXPO_OFFLINE: '1' },
    url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120000,
  },
});
