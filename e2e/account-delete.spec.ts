import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';
import { createPasswordUser, loginWithPassword } from './helpers/auth';

// Tự xoá tài khoản (SPEC-identity.md V5.3): sai mật khẩu báo lỗi; đúng thì đăng xuất, trang cá nhân ẩn ngay,
// đăng nhập lại trong 30 ngày là huỷ xoá.
test('xoá tài khoản bằng mật khẩu, đăng nhập lại là huỷ xoá', async ({ page }) => {
  const stamp = String(Date.now()).slice(-6);
  const email = `xoa-${stamp}@9mua.test`;
  const user = await createPasswordUser(email, `Sắp xoá ${stamp}`, 'matkhau-xoa-1');
  await loginWithPassword(page, email, 'matkhau-xoa-1', '/tai-khoan/cai-dat');
  await page.waitForURL(/\/tai-khoan\/cai-dat/);
  await page.getByTestId('delete-account-link').click();
  const form = page.getByTestId('delete-password-form');
  await form.locator('[name=password]').fill('sai-mat-khau');
  await page.getByTestId('delete-submit').click();
  await expect(page.getByTestId('delete-error')).toBeVisible();
  await page.getByTestId('delete-password-form').locator('[name=password]').fill('matkhau-xoa-1');
  await page.getByTestId('delete-submit').click();
  await page.waitForURL(/da-xoa-tai-khoan=1/);
  expect((await e2eDb.user.findUniqueOrThrow({ where: { id: user.id } })).deleteRequestedAt).not.toBeNull();
  const profile = await page.goto(`/creator/${user.id}`);
  expect(profile?.status()).toBe(404);

  await loginWithPassword(page, email, 'matkhau-xoa-1', '/tai-khoan');
  await page.waitForURL(/\/tai-khoan/);
  expect((await e2eDb.user.findUniqueOrThrow({ where: { id: user.id } })).deleteRequestedAt).toBeNull();
});
