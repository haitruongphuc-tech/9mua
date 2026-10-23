import { execFileSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';
import { generate } from 'otplib';

const DB = process.env.DATABASE_URL_E2E ?? 'postgresql://ninemua:ninemua@localhost:5432/ninemua_dev';

// Nâng tài khoản (đang đăng nhập trên page) thành admin bằng lệnh CLI như trên VPS.
export function promoteToAdmin(phone: string) {
  execFileSync('node', ['dist/scripts/create-admin.mjs', '--phone', phone], {
    input: '\n',
    env: { ...process.env, DATABASE_URL: DB },
  });
}

export const totpCode = (secret: string, offsetSeconds = 0) =>
  generate({ secret, epoch: Math.floor(Date.now() / 1000) + offsetSeconds });

// Lần đầu vào /admin: cài 2 lớp bằng khoá hiện trên trang, trả về khoá để nhập mã các phiên sau.
export async function setUpAdminTotp(page: Page): Promise<string> {
  await page.goto('/admin');
  await page.waitForURL((u) => u.pathname === '/admin/xac-thuc/cai-dat');
  const secret = (await page.getByTestId('totp-secret').textContent())!.trim();
  await page.fill('#totp-code', await totpCode(secret));
  await page.getByRole('button', { name: 'Bật xác thực 2 lớp' }).click();
  await expect(page.getByTestId('backup-codes').locator('li')).toHaveCount(10);
  await page.getByRole('link', { name: /vào trang CEO/ }).click();
  await page.waitForURL((u) => u.pathname === '/admin');
  return secret;
}
