import { defineConfig, devices } from '@playwright/test';

// Tests run against the production build served exactly as GitHub Pages serves it.
// Build first: npm run build:pages
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4300/coach-connect-analytics/',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/serve-dist.mjs',
    url: 'http://localhost:4300/coach-connect-analytics/',
    reuseExistingServer: !process.env['CI'],
  },
});
