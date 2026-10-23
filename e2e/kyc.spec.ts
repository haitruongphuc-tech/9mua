import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';
import { signUpWithKiot } from './helpers/seller';

const DB = process.env.DATABASE_URL_E2E ?? 'postgresql://ninemua:ninemua@localhost:5432/ninemua_dev';

test('KYC: người bán nộp CCCD; ảnh không xem được công khai; chỉ CEO xem được', async ({ page, browser }) => {
  const { phone } = await signUpWithKiot(page, 'Kiot KYC');
  await page.goto('/kiot-cua-toi/xac-minh');
  await page.fill('#kyc-name', 'Nguyễn Văn Bán');
  await page.fill('#kyc-number', '079 123 456 789');
  await page.setInputFiles('#kyc-front', 'e2e/fixtures/anh-cam.jpg');
  await page.setInputFiles('#kyc-back', 'e2e/fixtures/anh-den.jpg');
  await page.getByRole('button', { name: 'Gửi xác minh' }).click();
  await expect(page.getByTestId('kyc-status')).toContainText('Đang chờ duyệt');

  const user = await e2eDb.user.findFirstOrThrow({ where: { phone: '+84' + phone.slice(1) } });
  const sub = await e2eDb.kycSubmission.findFirstOrThrow({ where: { userId: user.id } });
  expect(sub.fullName).toBe('NGUYEN VAN BAN');

  // Không có đường công khai nào tới ảnh CCCD.
  const guest = await browser.newPage();
  expect((await guest.goto(`/uploads/${sub.frontImage}`))?.status()).toBe(404);
  expect((await guest.goto(`/api/admin/kyc/${sub.id}/front`))?.status()).toBe(404);
  // Chính người nộp (tài khoản thường) cũng không xem được qua route admin.
  expect((await page.goto(`/api/admin/kyc/${sub.id}/front`))?.status()).toBe(404);

  // Nâng tài khoản thành CEO → xem được.
  execFileSync('node', ['dist/scripts/create-admin.mjs', '--phone', phone], {
    input: '\n',
    env: { ...process.env, DATABASE_URL: DB },
  });
  const asAdmin = await page.goto(`/api/admin/kyc/${sub.id}/front`);
  expect(asAdmin?.status()).toBe(200);
  expect(asAdmin?.headers()['content-type']).toBe('image/webp');
  await guest.close();
});
