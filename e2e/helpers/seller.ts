import { expect, type Page } from '@playwright/test';

let seq = 0;

// Đăng ký tài khoản mới và tạo Kiot nháp; trả về slug của Kiot.
export async function signUpWithKiot(
  page: Page,
  name = 'Kiot E2E',
): Promise<{ phone: string; slug: string }> {
  seq += 1;
  const stamp = `${String(Date.now()).slice(-7)}${seq}`;
  const phone = `03${stamp.slice(-8)}`;
  await page.goto('/dang-ky?next=/kiot-cua-toi/tao');
  await page.fill('#identifier', phone);
  await page.fill('#displayName', 'Chủ Kiot');
  await page.fill('#password', 'mat-khau-kiot-e2e');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => u.pathname === '/kiot-cua-toi/tao');
  const slug = `e2e-${stamp}`;
  await page.fill('#kiot-name', `${name} ${stamp}`);
  await page.fill('#kiot-slug', slug);
  await page.fill('#kiot-phone', '0979393916');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => u.pathname === '/kiot-cua-toi');
  await expect(page.getByTestId('kiot-status')).toBeVisible();
  return { phone, slug };
}
