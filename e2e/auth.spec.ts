import { expect, test } from '@playwright/test';
import { codeFromMail, signUpByEmail } from './helpers/auth';
import { e2eDb } from './helpers/db';

test('đăng ký bằng mã email → thấy tên → dùng chung trên Kiot → đăng xuất → đăng nhập lại bằng mã', async ({
  page,
}) => {
  // Đăng ký chỉ cần email: tên tạm không lộ email; trang Tôi nhắc đặt tên, đặt trong trang Sửa hồ sơ.
  const email = await signUpByEmail(page, { next: '/tai-khoan' });
  await expect(page.getByTestId('user-menu')).toHaveAccessibleName(/^Tôi \(Thành viên \d{4}\)$/);
  await page.getByTestId('me-set-name').click();
  await page.waitForURL((u) => u.pathname === '/tai-khoan/ho-so');
  await page.fill('#profile-name', 'Khách E2E');
  await page.locator('#thong-tin button[type=submit]').click();
  await expect(page.getByTestId('user-menu')).toHaveAccessibleName('Tôi (Khách E2E)');
  await page.goto('/tai-khoan');
  await expect(page.getByTestId('me-set-name')).toHaveCount(0);

  // Cookie domain dùng chung: sang tên miền phụ của một Kiot vẫn đang đăng nhập.
  const port = new URL(page.url()).port;
  await page.goto(`http://abc.9mua.test:${port}/api/auth/me`);
  expect(JSON.parse((await page.textContent('body')) ?? '{}').user?.displayName).toBe('Khách E2E');
  await page.goto('/tai-khoan');

  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('user-menu')).toHaveAccessibleName('Tôi (đăng nhập)');

  // Gửi lại mã ngay thì bị chặn 60 giây.
  await page.goto('/tai-khoan');
  await expect(page).toHaveURL(/\/dang-nhap\?next=%2Ftai-khoan/);
  await page.getByTestId('otp-email').fill(email.toUpperCase());
  await page.getByTestId('otp-send').click();
  await expect(page.getByTestId('otp-error')).toContainText('chờ 60 giây');

  // Đăng nhập lại bằng mã mới (lùi giờ mã cũ trong DB thay vì chờ 60 giây thật).
  const old = await codeFromMail(email);
  await e2eDb.emailOtp.updateMany({ where: { email }, data: { createdAt: new Date(Date.now() - 120_000) } });
  await page.getByTestId('otp-send').click();
  await page.getByTestId('otp-code').fill(await codeFromMail(email, old));
  await page.getByTestId('otp-verify').click();
  await page.waitForURL((u) => u.pathname === '/tai-khoan');
  await expect(page.getByTestId('user-menu')).toHaveAccessibleName('Tôi (Khách E2E)');
});

test('mã sai thì báo lỗi; mã đúng thì vào', async ({ page }) => {
  const email = `ma-${Date.now()}@e2e.9mua.test`;
  await page.goto('/dang-nhap?next=/cho');
  await page.getByTestId('otp-email').fill(email);
  await page.getByTestId('otp-send').click();
  await expect(page.getByTestId('otp-sent')).toContainText(email);
  const code = await codeFromMail(email);
  await page.getByTestId('otp-code').fill(code === '000000' ? '111111' : '000000');
  await page.getByTestId('otp-verify').click();
  await expect(page.getByTestId('otp-error')).toHaveText('Mã không đúng.');
  await page.getByTestId('otp-code').fill(code);
  await page.getByTestId('otp-verify').click();
  await page.waitForURL((u) => u.pathname === '/cho');
  await expect(page.getByTestId('user-menu')).toHaveAccessibleName(/^Tôi \(Thành viên \d{4}\)$/);
});

test('sai mật khẩu hiện thông báo chung', async ({ page }) => {
  await page.goto('/dang-nhap');
  await page.fill('#identifier', `09${String(Date.now()).slice(-8)}`);
  await page.fill('#password', 'khong-dung-dau');
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('form-error')).toHaveText('Sai tài khoản hoặc mật khẩu.');
});
