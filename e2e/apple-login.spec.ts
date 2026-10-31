import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';

const SWITCH = 'feature.apple_login';
const setSwitch = (value: 'on' | 'off') =>
  e2eDb.setting.upsert({ where: { key: SWITCH }, create: { key: SWITCH, value }, update: { value } });

// Đăng nhập Apple (SPEC-identity.md V5.4): tắt sẵn thì không có nút; bật công tắc thì đăng nhập qua màn hình giả E2E.
test('nút Apple theo công tắc; đăng nhập Apple tạo tài khoản', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'công tắc chung, chạy một lần');
  await setSwitch('off');
  await page.goto('/dang-nhap');
  await expect(page.getByTestId('social-facebook')).toBeVisible();
  await expect(page.getByTestId('social-apple')).toHaveCount(0);
  await setSwitch('on');
  try {
    const stamp = String(Date.now()).slice(-6);
    await page.goto('/dang-nhap');
    await page.getByTestId('social-apple').click();
    await page.fill('#oauth-id', `apple-e2e-${stamp}`);
    await page.fill('#oauth-name', `Táo ${stamp}`);
    await page.getByRole('button', { name: 'Tiếp tục' }).click();
    await page.waitForURL((u) => !u.pathname.startsWith('/api/'));
    const ident = await e2eDb.authIdentity.findFirstOrThrow({
      where: { provider: 'apple', subject: `apple-e2e-${stamp}` },
    });
    const user = await e2eDb.user.findUniqueOrThrow({ where: { id: ident.userId } });
    expect(user.displayName).toBe(`Táo ${stamp}`);
  } finally {
    await setSwitch('off');
  }
});
