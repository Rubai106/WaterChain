import { defineConfig } from '@playwright/test';

// Run against a production build so the tests exercise the shipped app:
//   npm run build
//   npm run start -- -p 3107        (or let webServer below start it)
//   npx playwright install chromium  (first run only; downloads the browser)
//   npm run test:e2e
// In sandboxed CI without the Playwright browser cache, set
// PLAYWRIGHT_CHROMIUM_PATH to an existing Chromium binary instead.
// Tests use Playwright's isolated browser contexts, so no test case can
// contaminate a real user's investigations in another browser profile.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.WATERCHAIN_BASE_URL || 'http://localhost:3107',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run start -- -p 3107',
    url: 'http://localhost:3107',
    reuseExistingServer: true,
    timeout: 240000,
  },
});
