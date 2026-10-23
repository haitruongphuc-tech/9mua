import { expect, test } from '@playwright/test';

// SĐT ngẫu nhiên để chạy lặp lại trên cùng database.
const phone = `09${String(Date.now()).slice(-8)}`;
const password = 'matkhau-e2e-9mua';

test('đăng ký → thấy tên → dùng chung trên Kiot → đăng xuất → đăng nhập lại', async ({ page }) => {
  await page.goto('/dang-ky?next=/tai-khoan');
  await page.fill('#identifier', phone);
  await page.fill('#displayName', 'Khách E2E');
  await page.fill('#password', password);
  await page.click('button[type=submit]');

  await expect(page).toHaveURL(/\/tai-khoan$/);
  await expect(page.getByTestId('user-menu')).toHaveText('Khách E2E');

  // Cookie domain dùng chung: sang tên miền phụ của một Kiot vẫn đang đăng nhập.
  const port = new URL(page.url()).port;
  await page.goto(`http://abc.9mua.test:${port}/api/auth/me`);
  expect(JSON.parse((await page.textContent('body')) ?? '{}').user?.displayName).toBe('Khách E2E');
  await page.goto('/tai-khoan');

  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible();

  await page.goto('/tai-khoan');
  await expect(page).toHaveURL(/\/dang-nhap\?next=%2Ftai-khoan/);
  await page.fill('#identifier', phone.replace(/^0/, '+84'));
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await expect(page).toHaveURL(/\/tai-khoan$/);
});

test('sai mật khẩu hiện thông báo chung', async ({ page }) => {
  await page.goto('/dang-nhap');
  await page.fill('#identifier', '0909999999');
  await page.fill('#password', 'khong-dung-dau');
  await page.click('button[type=submit]');
  await expect(page.getByTestId('form-error')).toHaveText('Sai tài khoản hoặc mật khẩu.');
});
