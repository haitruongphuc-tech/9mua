import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
// Tên miền giả trỏ về 127.0.0.1 để test cookie dùng chung *.9mua.test giống hệt *.9mua.com
// (Chromium không chia sẻ cookie Domain=localhost sang abc.localhost).
const ORIGIN = `http://9mua.test:${PORT}`;
// Đường dẫn tuyệt đối: server.js của bản standalone tự chuyển thư mục làm việc.
export const E2E_CRON_TOKEN = 'e2e-internal-cron-token-9mua-0123456789';
export const MAIL_DIR = path.resolve('test-results/mail');

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['iPhone 13'],
    baseURL: ORIGIN,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--host-resolver-rules=MAP 9mua.test 127.0.0.1, MAP *.9mua.test 127.0.0.1'] },
  },
  // Chạy mọi kịch bản trên cả điện thoại (iPhone giả lập) và máy tính.
  projects: [
    { name: 'mobile-chromium', use: { browserName: 'chromium' } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Chạy đúng server.js của bản standalone như trong Docker production.
    command: 'sh scripts/start-standalone.sh',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      APP_URL: ORIGIN,
      TEST_MODE: 'e2e',
      // Giống image Docker (xem ghi chú trong src/middleware.ts).
      HOSTNAME: '0.0.0.0',
      PAYMENTS_DRIVER: 'fake',
      INTERNAL_CRON_TOKEN: E2E_CRON_TOKEN,
      MAIL_DRIVER: 'file',
      MAIL_OUTBOX_DIR: MAIL_DIR,
      UPLOAD_DIR: path.resolve('test-results/uploads'),
      PRIVATE_DIR: path.resolve('test-results/private'),
      DATABASE_URL: process.env.DATABASE_URL_E2E ?? 'postgresql://ninemua:ninemua@localhost:5432/ninemua_dev',
    },
  },
});
