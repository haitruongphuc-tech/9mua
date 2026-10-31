import { expect, test } from '@playwright/test';
import { newBuyerPage, signUpByEmail } from './helpers/auth';

// Nhiều tài khoản trên một máy (SPEC-identity.md V5.5): thêm tài khoản thứ hai, chuyển qua lại không nhập lại mật khẩu.
test('thêm tài khoản, chuyển tài khoản, đăng xuất tất cả', async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = String(Date.now()).slice(-6);
  const page = await newBuyerPage(browser, `Tài khoản A ${stamp}`);
  await page.goto('/tai-khoan');
  await page.getByTestId('account-add').click();
  await page.waitForURL(/\/dang-nhap/);
  await expect(page.getByTestId('login-back-account')).toContainText(`Tài khoản A ${stamp}`);
  await signUpByEmail(page, { name: `Tài khoản B ${stamp}`, next: '/tai-khoan' });
  await expect(page.getByTestId('user-menu')).toHaveAttribute(
    'aria-label',
    new RegExp(`Tài khoản B ${stamp}`),
  );

  await page
    .getByTestId('account-switch')
    .filter({ hasText: `Tài khoản A ${stamp}` })
    .click();
  await page.waitForURL(/\/tai-khoan/);
  await expect(page.getByTestId('user-menu')).toHaveAttribute(
    'aria-label',
    new RegExp(`Tài khoản A ${stamp}`),
  );
  await expect(page.getByTestId('account-switch')).toContainText(`Tài khoản B ${stamp}`);

  await page.getByTestId('account-logout-all').click();
  await page.waitForURL((u) => u.pathname === '/');
  await page.goto('/dang-nhap');
  await expect(page.getByTestId('login-back-account')).toHaveCount(0);
});
