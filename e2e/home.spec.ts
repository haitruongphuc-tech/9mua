import { expect, test } from '@playwright/test';
import { activateKiot, e2eDb } from './helpers/db';
import { signUpBuyer } from './helpers/orders';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

test('trang chủ → tìm → lọc Nông sản → trang Kiot → giỏ; báo cáo vi phạm', async ({ page, browser }) => {
  const stamp = String(Date.now()).slice(-6);
  const { slug } = await signUpWithKiot(page, 'Kiot Trang Chủ');
  await activateKiot(slug);
  const name = `Thanh long ruột đỏ ${stamp}`;
  await createProductViaUi(page, { name, price: '52000', category: 'nong-san' });

  const buyer = await signUpBuyer(browser);
  await buyer.goto('/');
  const stats = await buyer.getByTestId('home-stats').textContent();
  const [kiots, products] = (stats ?? '').match(/[\d.]+/g)!.map((n) => Number(n.replace(/\./g, '')));
  // Số liệu trang chủ cache 60 giây nên có thể chậm hơn DB một chút; độ chính xác đã test ở home.test.ts.
  expect(kiots).toBeGreaterThan(0);
  expect(kiots).toBeLessThanOrEqual(
    await e2eDb.kiot.count({ where: { activeUntil: { gt: new Date() }, lockedAt: null } }),
  );
  expect(products).toBeGreaterThan(0);
  await expect(buyer.getByRole('heading', { name: 'Mới lên Chợ' })).toBeVisible();

  await buyer.getByTestId('home-search').fill(`thanh long ruot do ${stamp}`);
  await buyer.getByTestId('home-search').press('Enter');
  await buyer.waitForURL((u) => u.pathname === '/cho');
  await buyer.getByRole('link', { name: /Nông sản/ }).click();
  await buyer.waitForURL((u) => u.searchParams.get('dm') === 'nong-san');
  await buyer.getByTestId('market-card').first().getByRole('link').click();
  await buyer.waitForURL((u) => u.hostname === `${slug}.9mua.test`);
  await expect(buyer.getByRole('heading', { level: 1 })).toHaveText(name);
  await buyer.getByRole('button', { name: /Thêm vào giỏ/ }).click();
  await expect(buyer.getByTestId('cart-message')).toContainText('Đã thêm');

  await buyer.getByText('Báo cáo vi phạm').click();
  await buyer.getByLabel('Hàng giả, hàng nhái').check();
  await buyer.getByRole('button', { name: 'Gửi báo cáo' }).click();
  await expect(buyer.getByTestId('report-ok')).toContainText('9MUA sẽ xem xét');
  const product = await e2eDb.product.findFirstOrThrow({ where: { name } });
  expect(await e2eDb.productReport.count({ where: { productId: product.id } })).toBe(1);

  // Đã đăng nhập bấm "Tạo Kiot" thì vào thẳng trang tạo Kiot.
  await buyer.goto('/');
  await buyer.getByRole('link', { name: /Tạo Kiot –/ }).click();
  await buyer.waitForURL((u) => u.pathname === '/kiot-cua-toi/tao');
});

test('sitemap và robots', async ({ page }) => {
  const robots = await page.goto('/robots.txt');
  expect(await robots!.text()).toContain('Sitemap: http://9mua.test:3100/sitemap.xml');
  const sitemap = await page.goto('/sitemap.xml');
  const xml = await sitemap!.text();
  expect(xml).toContain('<loc>http://9mua.test:3100/cho/nong-san</loc>');
  expect(xml).not.toContain('/kiot-cua-toi');
});
