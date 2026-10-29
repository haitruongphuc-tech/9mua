import { expect, test } from '@playwright/test';
import { codeFromMail } from './helpers/auth';
import { activateKiot, e2eDb } from './helpers/db';
import { signUpWithKiot } from './helpers/seller';

test('tài khoản nhận tiền: cần mật khẩu, chuẩn hoá tên, không lộ ra trang công khai', async ({
  page,
  browser,
}) => {
  // Người bán đăng ký bằng mã email chưa có mật khẩu: gợi ý dẫn tới "Đặt mật khẩu mới" trong Cài đặt tài khoản.
  const { email, slug } = await signUpWithKiot(page, 'Kiot E2E');
  await page.goto('/kiot-cua-toi/cai-dat');
  await page.getByTestId('no-password-hint').getByRole('link').click();
  await page.waitForURL((u) => u.pathname === '/tai-khoan/cai-dat');
  const signupCode = await codeFromMail(email);
  await e2eDb.emailOtp.updateMany({ where: { email }, data: { createdAt: new Date(Date.now() - 120_000) } });
  await page.getByTestId('set-password-send').click();
  await expect(page.getByTestId('set-password-code-ok')).toContainText('Đã gửi mã');
  await page.fill('#setpw-code', await codeFromMail(email, signupCode));
  await page.fill('#setpw-new', 'mat-khau-kiot-e2e');
  await page.fill('#setpw-confirm', 'mat-khau-kiot-e2e');
  await page.getByTestId('set-password-save').click();
  await expect(page.getByTestId('set-password-ok')).toBeVisible();

  await page.goto('/kiot-cua-toi/cai-dat');
  await page.selectOption('#bank-bin', '970422');
  await page.fill('#bank-account', '0979 393 916');
  await page.fill('#bank-name', 'Nguyễn Hải');
  await page.fill('#bank-password', 'sai-mat-khau');
  await page.locator('#tai-khoan-nhan-tien button[type=submit]').click();
  await expect(page.getByTestId('payout-error')).toHaveText('Mật khẩu không đúng.');

  await page.fill('#bank-password', 'mat-khau-kiot-e2e');
  await page.locator('#tai-khoan-nhan-tien button[type=submit]').click();
  await expect(page.getByTestId('payout-ok')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('payout-current')).toHaveText('Đang dùng: MB Bank · 0979393916 · NGUYEN HAI');

  await activateKiot(slug);
  const guest = await browser.newPage();
  await guest.goto(`http://${slug}.9mua.test:${new URL(page.url()).port}`);
  await expect(guest.locator('body')).not.toContainText('0979393916');
  await expect(guest.locator('body')).not.toContainText('NGUYEN HAI');
  await guest.close();
});
