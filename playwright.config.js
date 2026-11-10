import { defineConfig, devices } from '@playwright/test';

const chrome = process.env.CHROME_PATH ? { launchOptions: { executablePath: process.env.CHROME_PATH } } : {};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
    ...chrome,
  },
  projects: [
    { name: 'movil', use: { ...devices['Pixel 7'], ...chrome } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], ...chrome } },
  ],
  webServer: {
    command: 'node scripts/serve.mjs 5174',
    url: 'http://localhost:5174/index.html',
    reuseExistingServer: !process.env.CI,
  },
});
