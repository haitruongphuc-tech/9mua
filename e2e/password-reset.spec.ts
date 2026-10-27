import { expect, test } from '@playwright/test';
import { waitForMail } from './helpers/mail';

const email = `e2e-${Date.now()}@9mua.test`;

test('quên mật khẩu → mở link trong email → đặt mật khẩu mới → đăng nhập', async ({ page }) => {
  await page.goto('/dang-ky');
  await page.fill('#identifier', email);
  await page.fill('#displayName', 'Khách Quên');
  await page.fill('#password', 'mat-khau-cu-e2e');
  await page.click('button[type=submit]');
  await expect(page.getByTestId('user-menu')).toHaveAccessibleName('Tôi (Khách Quên)');
  await page.goto('/tai-khoan');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();

  await page.goto('/dang-nhap');
  await page.getByRole('link', { name: 'Quên mật khẩu?' }).click();
  await page.fill('#email', email.toUpperCase());
  await page.click('button[type=submit]');
  await expect(page.getByTestId('forgot-sent')).toBeVisible();

  const mail = await waitForMail(email);
  expect(mail.subject).toBe('Đặt lại mật khẩu 9MUA');
  const link = mail.text.match(/https?:\/\/\S+dat-lai-mat-khau\?token=\S+/)?.[0];
  expect(link).toBeTruthy();

  await page.goto(link!);
  await page.fill('#password', 'mat-khau-moi-e2e');
  await page.fill('#confirm', 'mat-khau-moi-e2e');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/da-dat-lai=1/, { timeout: 10_000 });

  await page.fill('#identifier', email);
  await page.fill('#password', 'mat-khau-moi-e2e');
  await page.click('button[type=submit]');
  await expect(page.getByTestId('user-menu')).toHaveAccessibleName('Tôi (Khách Quên)');

  // Link đã dùng thì không dùng lại được.
  await page.goto(link!);
  await page.fill('#password', 'mat-khau-thu-ba');
  await page.fill('#confirm', 'mat-khau-thu-ba');
  await page.click('button[type=submit]');
  await expect(page.getByTestId('form-error')).toContainText('Link đã hết hạn hoặc đã được dùng');
});
