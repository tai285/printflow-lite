import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against the full Docker stack:
//   docker compose up --build -d   (then)   npm run e2e
// They sign in as an admin that already exists in that stack:
//   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD (create it with `npm run user:create`).
const ADMIN_STATE = 'e2e/.auth/admin.json'

export default defineConfig({
  testDir: './e2e',
  // Tests share one database, so run them one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    // The API requires this header on every write (CSRF defence).
    extraHTTPHeaders: { 'X-Requested-With': 'printflow' },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: ADMIN_STATE },
    },
  ],
})
