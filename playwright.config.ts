import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
// Tên miền giả trỏ về 127.0.0.1 để test cookie dùng chung *.9mua.test giống hệt *.9mua.com
// (Chromium không chia sẻ cookie Domain=localhost sang abc.localhost).
const ORIGIN = `http://9mua.test:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['iPhone 13'],
    baseURL: ORIGIN,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--host-resolver-rules=MAP 9mua.test 127.0.0.1, MAP *.9mua.test 127.0.0.1'] },
  },
  projects: [{ name: 'mobile-chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    env: {
      APP_URL: ORIGIN,
      DATABASE_URL: process.env.DATABASE_URL_E2E ?? 'postgresql://ninemua:ninemua@localhost:5432/ninemua_dev',
    },
  },
});
