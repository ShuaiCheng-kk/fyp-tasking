import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,   // run sequentially — tests share seed data
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,             // one worker to avoid login conflicts
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start your Next.js dev server automatically before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,   // use already-running dev server if available
    timeout: 30000,
  },
})
