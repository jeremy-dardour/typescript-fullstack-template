import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env' });

export default defineConfig({
  testDir: './e2e/real',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 5000 },
  outputDir: 'test-results/real',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/real', open: 'never' }],
  ],
  use: {
    baseURL:
      process.env.PLAYWRIGHT_APP_BASE_URL ??
      `http://localhost:${process.env.WEB_PORT ?? '5173'}`,
    locale: 'en-US',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'real-chromium', use: { ...devices['Desktop Chrome'] } }],
});
