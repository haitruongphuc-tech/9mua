import { expect, test } from '@playwright/test';
import { signUpWithKiot } from './helpers/seller';

test('đăng sản phẩm có ảnh, đổi thứ tự ảnh, sửa giá; người khác không xem được', async ({
  page,
  browser,
}) => {
  await signUpWithKiot(page);
  await page.goto('/kiot-cua-toi/san-pham/moi');

  // File giả ảnh bị từ chối với thông báo rõ ràng.
  await page.getByTestId('image-input').setInputFiles('e2e/fixtures/khong-phai-anh.jpg');
  await expect(page.getByText('File không phải ảnh JPG, PNG hoặc WebP.')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng' }).click();

  await page
    .getByTestId('image-input')
    .setInputFiles(['e2e/fixtures/anh-cam.jpg', 'e2e/fixtures/anh-den.jpg']);
  await expect(page.locator('[data-testid=image-list] input[name=imageIds]')).toHaveCount(2);
  const before = await page
    .locator('[data-testid=image-list] input[name=imageIds]')
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  await page.getByRole('button', { name: 'Chuyển ảnh sang trái' }).nth(1).click();
  const after = await page
    .locator('[data-testid=image-list] input[name=imageIds]')
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(after).toEqual([before[1], before[0]]);

  await page.fill('#p-name', 'Thanh long ruột đỏ 1kg');
  await page.fill('#p-price', '45.000');
  await page.fill('#p-compare', '40000');
  await page.fill('#p-stock', '20');
  await page.selectOption('#p-category', 'nong-san');
  await page.click('button[type=submit]');
  await expect(page.getByText('Giá gốc phải lớn hơn giá bán')).toBeVisible();

  await page.fill('#p-compare', '60.000');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => u.pathname === '/kiot-cua-toi/san-pham');
  const row = page.getByTestId('product-list').getByRole('link', { name: /Thanh long ruột đỏ 1kg/ });
  await expect(row).toContainText('45.000đ');
  await expect(row.locator('img')).toHaveAttribute('src', /-400\.webp$/);

  await row.click();
  await page.waitForURL(/\/kiot-cua-toi\/san-pham\/[^/?]+$/);
  const editUrl = page.url();
  await page.fill('#p-price', '39000');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => u.pathname === '/kiot-cua-toi/san-pham');
  await expect(page.getByTestId('product-list')).toContainText('39.000đ');

  const other = await browser.newPage();
  await signUpWithKiot(other, 'Kiot khác');
  const res = await other.goto(editUrl);
  expect(res?.status()).toBe(404);
  await other.close();
});
