import { expect, test } from '@playwright/test';
import { codeFromMail, signUpWithPassword, uniqueEmail } from './helpers/auth';
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

  test('mở tài khoản ngay trong popup bằng mã email → đăng nhập, ở lại trang đang xem', async ({ page }) => {
    await page.goto('/cho/kiot');
    const popup = page.getByTestId('signup-popup');
    // 4 cách: Zalo, Google, Facebook (màn hình giả trên máy E2E) và Email.
    await expect(popup.getByTestId('social-zalo')).toBeVisible();
    await expect(popup.getByTestId('social-google')).toBeVisible();
    await expect(popup.getByTestId('social-facebook')).toBeVisible();
    const email = uniqueEmail('popup');
    await popup.getByTestId('otp-name').fill('Khách Popup');
    await popup.getByTestId('otp-email').fill(email);
    await popup.getByTestId('otp-send').click();
    await popup.getByTestId('otp-code').fill(await codeFromMail(email));
    await popup.getByTestId('otp-verify').click();
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

test('trang đăng ký chỉ còn Zalo, Google, Facebook, Email; không còn form SĐT + mật khẩu', async ({
  page,
}) => {
  await page.goto('/dang-ky');
  for (const p of ['zalo', 'google', 'facebook']) await expect(page.getByTestId(`social-${p}`)).toBeVisible();
  await expect(page.getByTestId('otp-email')).toBeVisible();
  await expect(page.locator('#password')).toHaveCount(0);
});

test('Google (giả lập): email mới → tạo tài khoản và đăng nhập', async ({ page }) => {
  const email = `gg-${stamp()}@gmail.com`;
  await page.goto('/dang-nhap?next=/cho');
  await page.getByTestId('social-google').click();
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
  await signUpWithPassword(page, { identifier: email, name: 'Khách Cũ', password: 'mat-khau-cu-123' });
  await page.goto('/tai-khoan');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL((u) => u.pathname === '/');

  await page.goto('/dang-nhap');
  await page.getByTestId('social-google').click();
  await page.fill('#google-email', email);
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(page.getByTestId('login-notice')).toContainText(`Email ${email} đã có tài khoản 9MUA`);
  expect((await e2eDb.user.findUniqueOrThrow({ where: { email } })).googleSub).toBeNull();

  await page.fill('#identifier', email);
  await page.fill('#password', 'mat-khau-cu-123');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('user-menu')).toHaveAccessibleName('Tôi (Khách Cũ)');
  expect((await e2eDb.user.findUniqueOrThrow({ where: { email } })).googleSub).toBe(`fake-${email}`);
});

test('Facebook (giả lập): email trùng → nhập mã gửi về email đó để liên kết rồi vào luôn', async ({
  page,
}) => {
  const email = uniqueEmail('fb');
  await signUpWithPassword(page, { identifier: email, name: 'Chị Facebook', password: 'mat-khau-fb-123' });
  await page.goto('/tai-khoan');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL((u) => u.pathname === '/');

  const fbId = `fb-${stamp()}`;
  await page.goto('/dang-nhap?next=/cho');
  await page.getByTestId('social-facebook').click();
  await page.fill('#oauth-id', fbId);
  await page.fill('#oauth-name', 'Chị FB');
  await page.fill('#oauth-email', email);
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(page.getByTestId('login-notice')).toContainText('liên kết Facebook');
  await page.getByTestId('otp-send').click();
  await page.getByTestId('otp-code').fill(await codeFromMail(email));
  await page.getByTestId('otp-verify').click();
  await page.waitForURL((u) => u.pathname === '/cho');
  await expect(page.getByTestId('user-menu')).toHaveAccessibleName('Tôi (Chị Facebook)');
  const user = await e2eDb.user.findUniqueOrThrow({ where: { email } });
  expect(
    await e2eDb.authIdentity.findUnique({
      where: { provider_subject: { provider: 'facebook', subject: fbId } },
    }),
  ).toMatchObject({ userId: user.id });
});

test('Zalo (giả lập): tạo tài khoản chỉ có tên; mở Kiot phải thêm email bằng mã trước', async ({ page }) => {
  await page.goto('/dang-ky?next=/kiot-cua-toi/tao');
  await page.getByTestId('social-zalo').click();
  await page.fill('#oauth-id', `zalo-${stamp()}`);
  await page.fill('#oauth-name', 'Anh Zalo');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await page.waitForURL((u) => u.pathname === '/kiot-cua-toi/tao');
  await expect(page.getByTestId('user-menu')).toHaveAccessibleName('Tôi (Anh Zalo)');
  await expect(page.getByTestId('add-email-gate')).toBeVisible();

  const email = uniqueEmail('zalo');
  await page.getByTestId('otp-email').fill(email);
  await page.getByTestId('otp-send').click();
  await page.getByTestId('otp-code').fill(await codeFromMail(email));
  await page.getByTestId('otp-verify').click();
  await expect(page.locator('#kiot-name')).toBeVisible();
  expect((await e2eDb.user.findUniqueOrThrow({ where: { email } })).displayName).toBe('Anh Zalo');
});
