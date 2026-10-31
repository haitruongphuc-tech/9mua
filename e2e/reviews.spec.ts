import { expect, test } from '@playwright/test';
import { activateKiot, e2eDb } from './helpers/db';
import { addFirstProductOfKiot, checkoutAndPay, signUpBuyer } from './helpers/orders';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

// Đánh giá (SPEC-orders.md V5.1): đơn đã giao → người mua đánh giá 4 sao kèm chữ → trang sản phẩm hiện đánh giá; chủ
// Kiot trả lời ở /kiot-cua-toi/danh-gia.
test('mua → đã giao → đánh giá → hiện trên trang sản phẩm → chủ Kiot trả lời', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const { slug } = await signUpWithKiot(page, 'Kiot Đánh Giá');
  await createProductViaUi(page, { name: 'Mật ong rừng', price: '150000', stock: '10' });
  await activateKiot(slug);
  const buyer = await signUpBuyer(browser, 'Khách Đánh Giá');
  await addFirstProductOfKiot(buyer, slug);
  const checkout = await checkoutAndPay(buyer, browser);
  const order = await e2eDb.order.findFirstOrThrow({ where: { checkoutId: checkout } });
  await e2eDb.order.update({
    where: { id: order.id },
    data: { status: 'delivered', deliveredAt: new Date() },
  });

  await buyer.goto(`/don-mua/${order.id}`);
  await buyer.getByTestId('review-link').first().click();
  await buyer.getByTestId('review-star-4').check();
  await buyer.getByTestId('review-form').locator('[name=text]').fill('Mật ong thơm, đóng gói kỹ');
  await buyer.getByTestId('review-submit').click();
  await expect(buyer.getByTestId('review-saved')).toBeVisible();
  await expect(buyer.getByTestId('review-mine')).toContainText('Mật ong thơm');

  const product = await e2eDb.product.findFirstOrThrow({ where: { kiot: { slug } } });
  expect(product.ratingCount).toBe(1);
  await buyer.goto(`/k/${slug}/p/${product.id}`);
  await expect(buyer.getByTestId('product-reviews')).toContainText('Mật ong thơm');
  await expect(buyer.getByTestId('review-avg')).toContainText('4');

  await page.goto('/kiot-cua-toi/danh-gia');
  await page.getByTestId('review-reply-text').fill('Cảm ơn bạn đã ủng hộ');
  await page.getByTestId('review-reply-submit').click();
  await expect(page.getByTestId('seller-reviews')).toContainText('Cảm ơn bạn đã ủng hộ');
});
