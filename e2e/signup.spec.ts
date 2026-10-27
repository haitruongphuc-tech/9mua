import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';

const stamp = () => String(Date.now()).slice(-8);

test.describe('popup mở tài khoản (khách mới)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('hiện sau 1,2 giây; "Để sau" thì không hiện lại', async ({ page }) => {
    await page.goto('/cho');
    const popup = page.getByTestId('signup-popup');
    await expect(popup).toBeVisible({ timeout: 5000 });
    await expect(popup.getByRole('heading')).toHaveText(
      'Mở tài khoản miễn phí - Dùng như TikTok - Không cần mua Kiot',
    );
    await popup.getByRole('button', { name: 'Để sau, xem trước đã' }).click();
    await expect(popup).toBeHidden();
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(popup).toBeHidden();
  });

  test('mở tài khoản ngay trong popup → đăng nhập, ở lại trang đang xem', async ({ page }) => {
    await page.goto('/cho/kiot');
    const popup = page.getByTestId('signup-popup');
    await popup.getByLabel('Tên hiển thị').fill('Khách Popup');
    await popup.getByLabel('Số điện thoại hoặc email').fill(`03${stamp()}`);
    await popup.getByLabel('Mật khẩu').fill('mat-khau-popup');
    await popup.getByRole('button', { name: 'MỞ TÀI KHOẢN MIỄN PHÍ' }).click();
    await page.waitForURL((u) => u.pathname === '/cho/kiot');
    await expect(page.getByTestId('user-menu')).toHaveAccessibleName('Tôi (Khách Popup)');
    await expect(popup).toBeHidden();
  });

  test('không hiện trên trang đăng nhập', async ({ page }) => {
    await page.goto('/dang-nhap');
    await page.waitForTimeout(2000);
    await expect(page.getByTestId('signup-popup')).toBeHidden();
  });
});

test('Google (giả lập): email mới → tạo tài khoản và đăng nhập', async ({ page }) => {
  const email = `gg-${stamp()}@gmail.com`;
  await page.goto('/dang-nhap?next=/cho');
  await page.getByRole('link', { name: 'Tiếp tục với Google' }).click();
  await page.fill('#google-email', email);
  await page.fill('#google-name', 'Bạn Google');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.waitForURL((u) => u.pathname === '/cho');
  await expect(page.getByTestId('user-menu')).toHaveAccessibleName('Tôi (Bạn Google)');
  expect((await e2eDb.user.findUniqueOrThrow({ where: { email } })).googleSub).toBe(`fake-${email}`);
});

test('Google (giả lập): email trùng tài khoản cũ → đăng nhập mật khẩu một lần để liên kết', async ({
  page,
}) => {
  const email = `cu-${stamp()}@9mua.test`;
  await page.goto('/dang-ky');
  await page.fill('#displayName', 'Khách Cũ');
  await page.fill('#identifier', email);
  await page.fill('#password', 'mat-khau-cu-123');
  await page.getByRole('button', { name: 'Đăng ký' }).click();
  await page.waitForURL((u) => u.pathname === '/');
  await page.goto('/tai-khoan');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL((u) => u.pathname === '/');

  await page.goto('/dang-nhap');
  await page.getByRole('link', { name: 'Tiếp tục với Google' }).click();
  await page.fill('#google-email', email);
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(page.getByTestId('login-notice')).toContainText(
    'Đăng nhập bằng mật khẩu một lần để liên kết Google',
  );
  expect((await e2eDb.user.findUniqueOrThrow({ where: { email } })).googleSub).toBeNull();

  await page.fill('#identifier', email);
  await page.fill('#password', 'mat-khau-cu-123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByTestId('user-menu')).toHaveAccessibleName('Tôi (Khách Cũ)');
  expect((await e2eDb.user.findUniqueOrThrow({ where: { email } })).googleSub).toBe(`fake-${email}`);
});
