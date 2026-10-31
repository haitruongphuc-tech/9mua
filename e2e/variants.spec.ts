import { expect, test } from '@playwright/test';
import { activateKiot, e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

const SWITCH = 'feature.variants';
const setSwitch = (value: 'on' | 'off') =>
  e2eDb.setting.upsert({ where: { key: SWITCH }, create: { key: SWITCH, value }, update: { value } });

// Biến thể (SPEC-kiot.md V5.6): chủ Kiot thêm 2 biến thể; người mua chọn biến thể rồi thêm vào giỏ, giỏ ghi nhãn.
test('biến thể: chủ Kiot tạo, người mua chọn và thêm vào giỏ', async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'công tắc chung, chạy một lần');
  test.setTimeout(90_000);
  await setSwitch('on');
  try {
    const { slug } = await signUpWithKiot(page, 'Kiot Biến Thể');
    await createProductViaUi(page, { name: 'Dép tổ ong', price: '50000', stock: '10' });
    await activateKiot(slug);
    const product = await e2eDb.product.findFirstOrThrow({ where: { kiot: { slug } } });
    await page.goto(`/kiot-cua-toi/san-pham/${product.id}`);
    await page.getByTestId('variant-name-0').fill('Size');
    for (const [size, price] of [
      ['39', '55000'],
      ['40', '60000'],
    ]) {
      await page.getByTestId('variant-add').click();
      const row = page.getByTestId('variant-row').last();
      await row.getByPlaceholder('Size').fill(size!);
      await row.getByPlaceholder('Giá bán').fill(price!);
      await row.getByPlaceholder('Tồn kho').fill('3');
    }
    await page.getByTestId('variant-save').click();
    await page.waitForURL(/da-luu=bien-the/);
    expect(await e2eDb.productVariant.count({ where: { productId: product.id } })).toBe(2);

    const buyer = await newBuyerPage(browser, 'Khách Biến Thể');
    await buyer.goto(`/k/${slug}/p/${product.id}`);
    await expect(buyer.getByTestId('product-price')).toContainText('55.000');
    await buyer.getByTestId('variant-select').selectOption({ index: 2 });
    await buyer.getByRole('button', { name: /Thêm vào giỏ/ }).click();
    await expect(buyer.getByTestId('cart-message')).toBeVisible();
    await buyer.goto('/gio-hang');
    await expect(buyer.getByTestId('cart-variant')).toContainText('40');
  } finally {
    await setSwitch('off');
  }
});
