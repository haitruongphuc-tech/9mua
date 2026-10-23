import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './test-database-url';

export default function setup() {
  if (!new URL(TEST_DATABASE_URL).pathname.endsWith('_test')) {
    throw new Error(`DATABASE_URL_TEST phải trỏ tới database có tên kết thúc bằng _test`);
  }
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
