import { expect, test } from '@playwright/test';
import { activateKiot, e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

// Tố cáo hàng giả (SPEC-orders.md V5.2): người mua gửi tố cáo từ trang sản phẩm → thấy hạn xử lý 24 giờ; chủ Kiot
// gửi giải trình.
test('tố cáo hàng giả: người mua gửi, chủ Kiot giải trình', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const { slug } = await signUpWithKiot(page, 'Kiot Bị Tố');
  await createProductViaUi(page, { name: 'Nước hoa nghi giả', price: '500000', stock: '5' });
  await activateKiot(slug);
  const product = await e2eDb.product.findFirstOrThrow({ where: { kiot: { slug } } });

  const buyer = await newBuyerPage(browser, 'Người tố cáo');
  await buyer.goto(`/k/${slug}/p/${product.id}`);
  await buyer.getByTestId('fake-report-link').click();
  await buyer
    .getByTestId('fake-form')
    .locator('[name=text]')
    .fill('Mùi khác hẳn hàng chính hãng, vỏ hộp in mờ, không có tem.');
  await buyer.getByTestId('fake-submit').click();
  await expect(buyer.getByTestId('fake-sent')).toBeVisible();

  await page.goto('/kiot-cua-toi/to-cao');
  await page.getByTestId('fake-response-text').fill('Chúng tôi có hoá đơn nhập từ nhà phân phối.');
  await page.getByTestId('fake-response-submit').click();
  await page.waitForURL(/da-gui=1/);
  await expect(page.getByTestId('seller-fake-reports')).toContainText('hoá đơn nhập');
});
