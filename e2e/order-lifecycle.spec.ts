import { expect, test, type Page } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { activateKiot, e2eDb } from './helpers/db';
import { addFirstProductOfKiot, checkoutAndPay, signUpBuyer } from './helpers/orders';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

async function openLatestSellerOrder(seller: Page) {
  await seller.goto('/kiot-cua-toi/don-hang?tab=tat-ca');
  await seller.getByTestId('seller-orders').getByRole('link').first().click();
}

test('vòng đời: mua → xác nhận → giao → đã nhận → (8 ngày) cron hoàn tất; khiếu nại có ảnh; hoàn tiền', async ({
  page,
  browser,
  request,
}) => {
  const { slug } = await signUpWithKiot(page, 'Kiot Vòng Đời');
  await createProductViaUi(page, { name: 'Cà phê Buôn Ma Thuột', price: '90000', stock: '10' });
  await activateKiot(slug);
  const buyer = await signUpBuyer(browser, 'Khách Vòng Đời');

  // Đơn 1: đi hết vòng đời tới hoàn tất.
  await addFirstProductOfKiot(buyer, slug);
  const checkout1 = await checkoutAndPay(buyer, browser);
  await openLatestSellerOrder(page);
  await page.getByRole('button', { name: 'Xác nhận đơn' }).click();
  await expect(page.getByTestId('order-status')).toHaveText('Đã xác nhận — đang chuẩn bị');
  await page.getByRole('button', { name: 'Đã giao cho shipper' }).click();
  await expect(page.getByTestId('order-status')).toHaveText('Đang giao');

  const order1 = await e2eDb.order.findFirstOrThrow({ where: { checkoutId: checkout1 } });
  await buyer.goto(`/don-mua/${order1.id}`);
  await buyer.getByTestId('receive-order').click();
  await expect(buyer.getByTestId('order-status')).toHaveText('Đã giao');

  // Giả lập đã qua 8 ngày rồi chạy cron như trên VPS.
  await e2eDb.order.update({
    where: { id: order1.id },
    data: { deliveredAt: new Date(Date.now() - 8 * 86_400_000) },
  });
  const tick = await request.get('http://localhost:3100/api/internal/orders/tick', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  expect(await tick.json()).toMatchObject({ completed: expect.any(Number) });
  await buyer.reload();
  await expect(buyer.getByTestId('order-status')).toHaveText('Hoàn tất');

  // Đơn 2: đã nhận rồi khiếu nại kèm ảnh.
  await addFirstProductOfKiot(buyer, slug);
  const checkout2 = await checkoutAndPay(buyer, browser);
  const order2 = await e2eDb.order.findFirstOrThrow({ where: { checkoutId: checkout2 } });
  await page.goto(`/kiot-cua-toi/don-hang/${order2.id}`);
  await page.getByRole('button', { name: 'Xác nhận đơn' }).click();
  await expect(page.getByTestId('order-status')).toHaveText('Đã xác nhận — đang chuẩn bị');
  await page.getByRole('button', { name: 'Đã giao cho shipper' }).click();
  await expect(page.getByTestId('order-status')).toHaveText('Đang giao');
  await buyer.goto(`/don-mua/${order2.id}`);
  await buyer.getByTestId('receive-order').click();
  await expect(buyer.getByTestId('order-status')).toHaveText('Đã giao');
  await buyer.getByText('Báo vấn đề với đơn hàng').click();
  await buyer.fill('#dispute-message', 'Hàng nhận được bị ẩm mốc, không dùng được');
  await buyer.getByTestId('image-input').setInputFiles('e2e/fixtures/anh-den.jpg');
  await expect(buyer.locator('[data-testid=image-list] input[name=imageIds]')).toHaveCount(1);
  await buyer.getByRole('button', { name: 'Gửi khiếu nại' }).click();
  await expect(buyer.getByTestId('order-status')).toHaveText('Đang khiếu nại');

  // Đơn 3: người bán từ chối → khách nhập tài khoản nhận hoàn tiền.
  await addFirstProductOfKiot(buyer, slug);
  const checkout3 = await checkoutAndPay(buyer, browser);
  const order3 = await e2eDb.order.findFirstOrThrow({ where: { checkoutId: checkout3 } });
  await page.goto(`/kiot-cua-toi/don-hang/${order3.id}`);
  await page.getByText('Từ chối đơn (hoàn tiền cho khách)').click();
  await page.fill('#reject-reason', 'Hết hàng đột xuất');
  await page.getByRole('button', { name: 'Từ chối đơn', exact: true }).click();
  await expect(page.getByTestId('order-status')).toHaveText('Chờ hoàn tiền');
  await buyer.goto(`/don-mua/${order3.id}`);
  await buyer.selectOption('#refund-bank', '970436');
  await buyer.fill('#refund-number', '1234567890');
  await buyer.fill('#refund-name', 'Khách Vòng Đời');
  await buyer.getByRole('button', { name: 'Lưu tài khoản' }).click();
  await expect(buyer.getByTestId('refund-info')).toContainText('KHACH VONG DOI');
  await buyer.close();
});
