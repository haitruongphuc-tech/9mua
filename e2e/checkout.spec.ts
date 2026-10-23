import { expect, test, type Page } from '@playwright/test';
import { activateKiot, e2eDb } from './helpers/db';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

async function sellerWithProduct(page: Page, name: string, price: string) {
  const { slug } = await signUpWithKiot(page, name);
  await createProductViaUi(page, { name: `${name} SP`, price, stock: '5' });
  await activateKiot(slug);
  return slug;
}

async function addFirstProduct(buyer: Page, slug: string) {
  const port = new URL(buyer.url()).port || '3100';
  await buyer.goto(`http://${slug}.9mua.test:${port}`);
  await buyer.getByTestId('product-grid').getByRole('link').first().click();
  await buyer.getByRole('button', { name: /Thêm vào giỏ/ }).click();
  await expect(buyer.getByTestId('cart-message')).toContainText('Đã thêm');
}

test('mua từ 2 Kiot bằng 1 QR → trả (PayOS giả) → cả 2 đơn đã thanh toán; tồn kho giảm', async ({
  page,
  browser,
}) => {
  const slugA = await sellerWithProduct(page, 'Kiot A', '45000');
  const sellerB = await browser.newPage();
  const slugB = await sellerWithProduct(sellerB, 'Kiot B', '30000');
  await sellerB.close();

  const buyer = await browser.newPage();
  await buyer.goto('/dang-ky?next=/');
  await buyer.fill('#identifier', `07${String(Date.now()).slice(-8)}`);
  await buyer.fill('#displayName', 'Người Mua 2 Kiot');
  await buyer.fill('#password', 'mat-khau-mua-2');
  await buyer.click('button[type=submit]');
  await buyer.waitForURL((u) => u.pathname === '/');
  await addFirstProduct(buyer, slugA);
  await addFirstProduct(buyer, slugB);

  await buyer.goto('/gio-hang');
  await expect(buyer.getByTestId('cart-group')).toHaveCount(2);
  await buyer.getByTestId('go-checkout').click();
  await expect(buyer.getByTestId('checkout-total')).toHaveText('75.000đ');
  await buyer.fill('#a-name', 'Trần Thị Mua');
  await buyer.fill('#a-phone', '0912 345 678');
  await buyer.fill('#a-province', 'TP. Hồ Chí Minh');
  await buyer.fill('#a-district', 'Quận Tân Phú');
  await buyer.fill('#a-ward', 'Phường Phú Thọ Hòa');
  await buyer.fill('#a-line', '115 Nguyễn Hậu');
  await buyer.getByRole('button', { name: /Đặt hàng và thanh toán/ }).click();
  await buyer.waitForURL(/\/dat-hang\/[^/]+$/);
  await expect(buyer.getByTestId('payment-amount')).toHaveText('75.000đ');

  const href = await buyer.getByRole('link', { name: /Mở trang thanh toán/ }).getAttribute('href');
  const payos = await browser.newPage();
  await payos.goto(href!);
  await payos.getByRole('button', { name: 'Giả lập đã trả đủ' }).click();
  await expect(payos.getByTestId('fake-status')).toHaveText('paid');
  await payos.close();
  await expect(buyer.getByTestId('order-paid')).toBeVisible({ timeout: 15_000 });

  const checkoutId = new URL(buyer.url()).pathname.split('/').pop()!;
  const orders = await e2eDb.order.findMany({ where: { checkoutId } });
  expect(orders.map((o) => o.status)).toEqual(['paid', 'paid']);
  const product = await e2eDb.product.findFirstOrThrow({ where: { kiot: { slug: slugA } } });
  expect(product.stock).toBe(4);
  await buyer.close();
});

test('huỷ đơn trước khi trả: hàng trả về kho', async ({ page, browser }) => {
  const slug = await sellerWithProduct(page, 'Kiot Huỷ', '20000');
  const buyer = await browser.newPage();
  await buyer.goto('/dang-ky?next=/');
  await buyer.fill('#identifier', `08${String(Date.now()).slice(-8)}`);
  await buyer.fill('#displayName', 'Người Huỷ');
  await buyer.fill('#password', 'mat-khau-huy-don');
  await buyer.click('button[type=submit]');
  await buyer.waitForURL((u) => u.pathname === '/');
  await addFirstProduct(buyer, slug);
  await buyer.goto('/dat-hang');
  for (const [id, value] of [
    ['#a-name', 'Lê Văn Huỷ'],
    ['#a-phone', '0987654321'],
    ['#a-province', 'Hà Nội'],
    ['#a-district', 'Ba Đình'],
    ['#a-ward', 'Kim Mã'],
    ['#a-line', '1 Kim Mã'],
  ]) {
    await buyer.fill(id!, value!);
  }
  await buyer.getByRole('button', { name: /Đặt hàng và thanh toán/ }).click();
  await buyer.waitForURL(/\/dat-hang\/[^/]+$/);
  await buyer.getByTestId('cancel-checkout').click();
  await expect(buyer.getByTestId('order-cancelled')).toBeVisible();
  const product = await e2eDb.product.findFirstOrThrow({ where: { kiot: { slug } } });
  expect(product.stock).toBe(5);
  await buyer.close();
});
