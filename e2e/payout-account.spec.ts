import { expect, test } from '@playwright/test';
import { activateKiot } from './helpers/db';
import { signUpWithKiot } from './helpers/seller';

test('tài khoản nhận tiền: cần mật khẩu, chuẩn hoá tên, không lộ ra trang công khai', async ({
  page,
  browser,
}) => {
  const { slug } = await signUpWithKiot(page);
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
