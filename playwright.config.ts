import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        headless: true,
        trace: 'retain-on-failure',
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        browserName: 'firefox',
        headless: true,
        trace: 'retain-on-failure',
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        browserName: 'webkit',
        headless: true,
        trace: 'retain-on-failure',
      },
    },
  ],
})
