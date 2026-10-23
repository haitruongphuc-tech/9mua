import { expect, test, type Page } from '@playwright/test';

async function signUp(page: Page, next: string) {
  const phone = `03${String(Date.now()).slice(-8)}`;
  await page.goto(`/dang-ky?next=${encodeURIComponent(next)}`);
  await page.fill('#identifier', phone);
  await page.fill('#displayName', 'Chủ Kiot E2E');
  await page.fill('#password', 'mat-khau-kiot-e2e');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => u.pathname === next);
  return phone;
}

test('tạo Kiot nháp: gợi ý địa chỉ, kiểm tra trùng/cấm, sửa địa chỉ khi còn nháp', async ({ page }) => {
  await signUp(page, '/kiot-cua-toi');
  await page.getByRole('link', { name: 'Tạo Kiot ngay' }).click();
  await page.waitForURL((u) => u.pathname === '/kiot-cua-toi/tao');

  const suffix = String(Date.now()).slice(-6);
  await page.fill('#kiot-name', `Thanh Long Bình Thuận ${suffix}`);
  await expect(page.locator('#kiot-slug')).toHaveValue(`thanh-long-binh-thuan-${suffix}`);
  await expect(page.getByTestId('slug-hint')).toContainText('còn trống');

  await page.fill('#kiot-slug', 'admin');
  await expect(page.getByTestId('slug-hint')).toContainText('9MUA giữ lại');
  await page.fill('#kiot-slug', `tl-${suffix}`);
  await expect(page.getByTestId('slug-hint')).toContainText('còn trống');

  await page.fill('#kiot-phone', '0979 393 916');
  await page.fill('#kiot-description', 'Thanh long ruột đỏ hái tại vườn');
  await page.click('button[type=submit]');

  await page.waitForURL((u) => u.pathname === '/kiot-cua-toi');
  await expect(page.getByTestId('kiot-status')).toHaveText('Nháp — chưa kích hoạt');
  await expect(page.getByTestId('kiot-url')).toHaveText(`tl-${suffix}.9mua.test`);

  await page.getByRole('link', { name: 'Cài đặt' }).click();
  await page.fill('#kiot-slug', `tl-moi-${suffix}`);
  await page.click('button[type=submit]');
  await expect(page.getByTestId('form-ok')).toBeVisible();
  await page.goto('/kiot-cua-toi');
  await expect(page.getByTestId('kiot-url')).toHaveText(`tl-moi-${suffix}.9mua.test`);
});
