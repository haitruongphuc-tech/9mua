import { expect, test } from '@playwright/test';
import { activateKiot, e2eDb } from './helpers/db';
import { signUpBuyer } from './helpers/orders';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

test('Chợ → tìm → lọc Nông sản → trang Kiot → giỏ; báo cáo vi phạm', async ({ page, browser }) => {
  const stamp = String(Date.now()).slice(-6);
  const { slug } = await signUpWithKiot(page, 'Kiot Trang Chủ');
  await activateKiot(slug);
  const name = `Thanh long ruột đỏ ${stamp}`;
  await createProductViaUi(page, { name, price: '52000', category: 'nong-san' });

  const buyer = await signUpBuyer(browser);
  // Từ T40 các khối trang chủ cũ (số liệu, Tạo Kiot, Bán chạy…) nằm ở đầu Chợ.
  await buyer.goto('/cho');
  const stats = await buyer.getByTestId('home-stats').textContent();
  const [kiots, products] = (stats ?? '').match(/[\d.]+/g)!.map((n) => Number(n.replace(/\./g, '')));
  // Số liệu trang chủ cache 60 giây nên có thể chậm hơn DB một chút; độ chính xác đã test ở home.test.ts.
  expect(kiots).toBeGreaterThan(0);
  expect(kiots).toBeLessThanOrEqual(
    await e2eDb.kiot.count({ where: { activeUntil: { gt: new Date() }, lockedAt: null } }),
  );
  expect(products).toBeGreaterThan(0);
  await expect(buyer.getByRole('heading', { name: 'Tất cả sản phẩm' })).toBeVisible();

  const search = buyer.getByRole('searchbox', { name: 'Tìm sản phẩm' });
  await search.fill(`thanh long ruot do ${stamp}`);
  await search.press('Enter');
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
  await buyer.goto('/cho');
  await buyer.getByRole('link', { name: /Tạo Kiot –/ }).click();
  await buyer.waitForURL((u) => u.pathname === '/kiot-cua-toi/tao');
});

test('trang chủ là feed video nằm giữa thanh trên và thanh điều hướng dưới', async ({ page, isMobile }) => {
  const author = await e2eDb.user.findFirstOrThrow({ where: { lockedAt: null } });
  await e2eDb.video.create({
    data: {
      authorId: author.id,
      caption: `Video trang chủ ${Date.now()}`,
      status: 'ready',
      fileUrl: '/uploads/khong-co.mp4',
      readyAt: new Date(),
      durationSec: 10,
      score: 1000,
    },
  });
  await page.goto('/');
  const feed = page.getByTestId('video-feed');
  await expect(feed).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/9MUA/); // cho Google, ẩn khỏi mắt
  await expect(page.getByRole('link', { name: 'Đóng' })).toHaveCount(0);
  const header = (await page.getByRole('banner').boundingBox())!;
  const box = (await feed.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
  if (isMobile) {
    const nav = (await page.getByRole('navigation', { name: 'Điều hướng chính' }).boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(nav.y + 1);
  }
});

test('sitemap và robots', async ({ page }) => {
  const robots = await page.goto('/robots.txt');
  expect(await robots!.text()).toContain('Sitemap: http://9mua.test:3100/sitemap.xml');
  const sitemap = await page.goto('/sitemap.xml');
  const xml = await sitemap!.text();
  expect(xml).toContain('<loc>http://9mua.test:3100/cho/nong-san</loc>');
  expect(xml).not.toContain('/kiot-cua-toi');
});
