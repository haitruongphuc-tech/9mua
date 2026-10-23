import { expect, test } from '@playwright/test';
import { activateKiot } from './helpers/db';
import { addFirstProductOfKiot, checkoutAndPay, signUpBuyer } from './helpers/orders';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

test('người bán: thấy đơn mới có địa chỉ khách → xác nhận → giao hàng kèm mã vận đơn', async ({
  page,
  browser,
}) => {
  const { slug } = await signUpWithKiot(page, 'Kiot Xử Lý Đơn');
  await createProductViaUi(page, { name: 'Giỏ tre', price: '120000', stock: '3' });
  await activateKiot(slug);

  const buyer = await signUpBuyer(browser);
  await addFirstProductOfKiot(buyer, slug);
  await checkoutAndPay(buyer, browser);
  await buyer.close();

  await page.goto('/kiot-cua-toi/don-hang');
  await page.getByTestId('seller-orders').getByRole('link').first().click();
  await expect(page.getByTestId('order-status')).toHaveText('Đã thanh toán — chờ xác nhận');
  await expect(page.getByTestId('ship-to')).toContainText('115 Nguyễn Hậu');
  await expect(page.getByTestId('ship-to')).toContainText('0912345678');

  await page.getByRole('button', { name: 'Xác nhận đơn' }).click();
  await expect(page.getByTestId('order-status')).toHaveText('Đã xác nhận — đang chuẩn bị');
  await page.fill('#ship-tracking', 'GHN-123456');
  await page.fill('#ship-carrier', 'GHN');
  await page.getByRole('button', { name: 'Đã giao cho shipper' }).click();
  await expect(page.getByTestId('order-status')).toHaveText('Đang giao');
  await expect(page.getByTestId('ship-to')).toContainText('GHN-123456');
  await expect(page.getByTestId('order-timeline')).toContainText('Người bán xác nhận');
  await expect(page.getByTestId('order-timeline')).toContainText('Đã giao cho shipper');
});
