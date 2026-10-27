import { expect, type Browser, type Page } from '@playwright/test';

let seq = 0;

export async function signUpBuyer(browser: Browser, name = 'Người Mua E2E'): Promise<Page> {
  seq += 1;
  const buyer = await browser.newPage();
  await buyer.goto('/dang-ky?next=/');
  await buyer.fill('#identifier', `09${String(Date.now() + seq).slice(-8)}`);
  await buyer.fill('#displayName', name);
  await buyer.fill('#password', 'mat-khau-nguoi-mua-e2e');
  await buyer.click('button[type=submit]');
  await buyer.waitForURL((u) => u.pathname === '/');
  return buyer;
}

export async function addFirstProductOfKiot(buyer: Page, slug: string) {
  await buyer.goto(`http://${slug}.9mua.test:3100`);
  await buyer.getByTestId('product-grid').getByRole('link').first().click();
  await buyer.getByRole('button', { name: /Thêm vào giỏ/ }).click();
  await expect(buyer.getByTestId('cart-message')).toContainText('Đã thêm');
}

// Đặt hàng từ giỏ hiện tại và trả qua PayOS giả; trả về id checkout.
export async function checkoutAndPay(buyer: Page, browser: Browser): Promise<string> {
  await buyer.goto('/dat-hang');
  await buyer.fill('#a-name', 'Trần Thị Mua');
  await buyer.fill('#a-phone', '0912345678');
  await buyer.fill('#a-province', 'TP. Hồ Chí Minh');
  await buyer.fill('#a-district', 'Quận Tân Phú');
  await buyer.fill('#a-ward', 'Phường Phú Thọ Hòa');
  await buyer.fill('#a-line', '115 Nguyễn Hậu');
  await buyer.getByRole('button', { name: /Đặt hàng và thanh toán/ }).click();
  await buyer.waitForURL(/\/dat-hang\/[^/]+$/);
  const href = await buyer.getByRole('link', { name: /Mở trang thanh toán/ }).getAttribute('href');
  const payos = await browser.newPage();
  await payos.goto(href!);
  await payos.getByRole('button', { name: 'Giả lập đã trả đủ' }).click();
  // Webhook giả xử lý không đồng bộ; khi máy test bận có lúc quá 5 giây.
  await expect(payos.getByTestId('fake-status')).toHaveText('paid', { timeout: 15_000 });
  await payos.close();
  await expect(buyer.getByTestId('order-paid')).toBeVisible({ timeout: 15_000 });
  return new URL(buyer.url()).pathname.split('/').pop()!;
}
