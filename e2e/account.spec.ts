import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { codeFromMail, signUpWithPassword } from './helpers/auth';

const stamp = String(Date.now()).slice(-8);
const DB = process.env.DATABASE_URL_E2E ?? 'postgresql://ninemua:ninemua@localhost:5432/ninemua_dev';

// Tài khoản cũ có mật khẩu (đổi email, đổi mật khẩu cần mật khẩu hiện tại).
async function signUp(page: Page, phone: string, password: string) {
  await signUpWithPassword(page, {
    identifier: phone,
    name: 'Khách Tài Khoản',
    password,
    next: '/tai-khoan',
  });
}

test('cài đặt tài khoản: đổi tên, thêm email, đổi mật khẩu', async ({ page }) => {
  const phone = `07${stamp}`;
  await signUp(page, phone, 'mat-khau-1-e2e');
  // Trang Tôi V4 có lối vào Cài đặt tài khoản (T65).
  await expect(page.getByTestId('me-badge')).toHaveText('TÀI KHOẢN FREE');
  await expect(page.getByTestId('me-free')).toContainText('Đang dùng Free • 0/50 tim/follow hôm nay');
  await page.getByRole('link', { name: /Cài đặt tài khoản/ }).click();
  await page.waitForURL((u) => u.pathname === '/tai-khoan/cai-dat');

  await page.fill('#profile-name', 'Tên Mới E2E');
  await page.locator('#thong-tin button[type=submit]').click();
  await expect(page.getByTestId('profile-ok')).toBeVisible();
  await expect(page.getByTestId('user-menu')).toHaveAccessibleName('Tôi (Tên Mới E2E)');

  // Tài khoản chưa có email: thêm email bằng mã gửi về email đó (không cần mật khẩu).
  await page.getByTestId('otp-email').fill(`acc-${stamp}@9mua.test`);
  await page.getByTestId('otp-send').click();
  await page.getByTestId('otp-code').fill(await codeFromMail(`acc-${stamp}@9mua.test`));
  await page.getByTestId('otp-verify').click();
  await expect(page.getByTestId('otp-done')).toBeVisible();

  await page.fill('#pw-old', 'mat-khau-1-e2e');
  await page.fill('#pw-new', 'mat-khau-2-e2e');
  await page.fill('#pw-confirm', 'mat-khau-2-e2e');
  await page.locator('#doi-mat-khau button[type=submit]').click();
  await expect(page.getByTestId('password-ok')).toBeVisible();

  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.goto('/dang-nhap');
  await page.fill('#identifier', `acc-${stamp}@9mua.test`);
  await page.fill('#password', 'mat-khau-2-e2e');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('user-menu')).toHaveAccessibleName('Tôi (Tên Mới E2E)');
});

test('/admin: tài khoản thường thấy 404, CEO tạo bằng CLI vào được', async ({ page }) => {
  const phone = `08${stamp}`;
  await signUp(page, phone, 'mat-khau-ceo-e2e');

  const res = await page.goto('/admin');
  expect(res?.status()).toBe(404);

  execFileSync('node', ['dist/scripts/create-admin.mjs', '--phone', phone], {
    input: '\n',
    env: { ...process.env, DATABASE_URL: DB },
  });

  // Lần đầu vào trang CEO: bắt buộc cài xác thực 2 lớp (T31).
  const ok = await page.goto('/admin');
  expect(ok?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe('/admin/xac-thuc/cai-dat');
  await expect(page.getByRole('heading', { name: 'Cài xác thực 2 lớp' })).toBeVisible();
});
