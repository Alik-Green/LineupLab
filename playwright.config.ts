import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: process.env.UI_BASE_URL ?? 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] },
  },
  projects: [{ name: 'desktop', testIgnore: /android-.*\.spec\.ts/, use: { viewport: { width: 1440, height: 900 } } }, { name: 'android', testMatch: /android-.*\.spec\.ts/, use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, baseURL: process.env.MOBILE_BASE_URL ?? 'http://127.0.0.1:5174' } }],
});
