import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './tests/test-database-url';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    env: { NODE_ENV: 'test', DATABASE_URL: TEST_DATABASE_URL },
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/setup.ts'],
    // Các file test dùng chung một database test nên chạy tuần tự.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
