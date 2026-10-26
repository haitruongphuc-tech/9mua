import { expect, type Page } from '@playwright/test';

// Đăng một sản phẩm qua giao diện người bán; trả về đường dẫn trang sửa.
export async function createProductViaUi(
  page: Page,
  p: { name: string; price: string; stock?: string; category?: string; description?: string },
) {
  await page.goto('/kiot-cua-toi/san-pham/moi');
  await page.getByTestId('image-input').setInputFiles(['e2e/fixtures/anh-cam.jpg']);
  await expect(page.locator('[data-testid=image-list] input[name=imageIds]')).toHaveCount(1);
  await page.fill('#p-name', p.name);
  if (p.description) await page.fill('#p-description', p.description);
  await page.fill('#p-price', p.price);
  await page.fill('#p-stock', p.stock ?? '10');
  await page.selectOption('#p-category', p.category ?? 'nong-san');
  await page.click('button[type=submit]');
  await page.waitForURL((u) => u.pathname === '/kiot-cua-toi/san-pham');
}
