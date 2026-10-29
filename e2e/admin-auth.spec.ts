import { expect, test } from '@playwright/test';
import { signUpWithPassword } from './helpers/auth';
import { promoteToAdmin, setUpAdminTotp, totpCode } from './helpers/admin';
import { signUpBuyer } from './helpers/orders';

const ADMIN_PATHS = [
  '/admin',
  '/admin/xac-thuc',
  '/admin/xac-thuc/cai-dat',
  '/admin/rut-tien',
  '/api/admin/kyc/x/front',
];

test('trang CEO: người thường nhận 404; admin bắt buộc cài và nhập mã 2 lớp mỗi phiên', async ({
  browser,
}) => {
  const guest = await browser.newPage();
  for (const p of ADMIN_PATHS) expect((await guest.goto(p))?.status(), p).toBe(404);
  const user = await signUpBuyer(browser, 'Người thường');
  for (const p of ADMIN_PATHS) expect((await user.goto(p))?.status(), p).toBe(404);

  // Tài khoản CEO mới: đăng ký, nâng quyền bằng CLI, lần đầu vào phải cài 2 lớp.
  const phone = `07${String(Date.now()).slice(-8)}`;
  const ceo = await browser.newPage();
  await signUpWithPassword(ceo, {
    identifier: phone,
    name: 'CEO thử',
    password: 'mat-khau-ceo-e2e-123',
    next: '/',
  });
  promoteToAdmin(phone);
  const secret = await setUpAdminTotp(ceo);
  await expect(ceo.getByTestId('todo-box')).toBeVisible();

  // Phiên đăng nhập mới (thiết bị khác): mật khẩu đúng vẫn phải nhập mã 2 lớp.
  const other = await browser.newPage();
  await other.goto('/dang-nhap?next=/admin');
  await other.fill('#identifier', phone);
  await other.fill('#password', 'mat-khau-ceo-e2e-123');
  await other.getByTestId('login-submit').click();
  await other.waitForURL((u) => u.pathname === '/admin/xac-thuc');
  await other.fill('#totp-code', '000000');
  await other.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(other.getByTestId('totp-error')).toContainText('Mã không đúng');
  // Mã của chu kỳ 30 giây kế tiếp (trong dung sai ±30 giây) để không trùng mã vừa dùng lúc cài.
  await other.fill('#totp-code', await totpCode(secret, 30));
  await other.getByRole('button', { name: 'Xác nhận' }).click();
  await other.waitForURL((u) => u.pathname === '/admin');
  await expect(other.getByTestId('todo-box')).toBeVisible();
});

test('tổng quan CEO: hộp "Cần xử lý" và số liệu hiện gọn trên màn hình 375px', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  const phone = `07${String(Date.now()).slice(-8)}`;
  await signUpWithPassword(page, {
    identifier: phone,
    name: 'CEO số liệu',
    password: 'mat-khau-ceo-e2e-123',
    next: '/',
  });
  promoteToAdmin(phone);
  await setUpAdminTotp(page);
  await expect(page.getByTestId('todo-box')).toBeVisible();
  await expect(page.getByTestId('metrics')).toContainText('Tiền đang giữ hộ');
  await page.getByRole('link', { name: '30 ngày' }).click();
  await page.waitForURL((u) => u.searchParams.get('khoang') === '30-ngay');
  // Không tràn ngang trên điện thoại.
  const wide = await page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > 376 && !el.closest('[class*=overflow-x-auto]'))
      .slice(0, 5)
      .map((el) => `${el.tagName}.${(el as HTMLElement).className}`.slice(0, 120)),
  );
  expect(wide).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
