import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  /* Матрица поддерживаемых браузеров и устройств (см. раздел 4.5
   * PRODUCTION_READINESS.md). Проверяются Chromium, Firefox, WebKit и
   * мобильный Chrome. Локально запускаются только установленные браузеры:
   * `pnpm exec playwright install chromium firefox webkit`. */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        trace: 'retain-on-failure',
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        headless: true,
        trace: 'retain-on-failure',
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        headless: true,
        trace: 'retain-on-failure',
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        headless: true,
        trace: 'retain-on-failure',
      },
    },
  ],
})
