import { expect, test } from '@playwright/test';
import { activateKiot, e2eDb } from './helpers/db';
import { signUpBuyer } from './helpers/orders';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

test('Chợ: gõ không dấu tìm ra sản phẩm, lọc danh mục, mở trang Kiot và thêm vào giỏ', async ({
  page,
  browser,
}) => {
  const stamp = String(Date.now()).slice(-6);
  const { slug } = await signUpWithKiot(page, 'Kiot Thanh Long');
  await activateKiot(slug);
  await e2eDb.kiot.update({ where: { slug }, data: { province: 'lam-dong' } });
  const name = `Thanh Long Bình Thuận ${stamp}`;
  await createProductViaUi(page, { name, price: '45000', category: 'nong-san' });

  const buyer = await signUpBuyer(browser);
  await buyer.goto('/cho');
  await buyer.getByTestId('market-search').fill(`thanh long binh thuan ${stamp}`);
  await buyer.getByRole('button', { name: 'Tìm' }).click();
  await buyer.waitForURL((u) => u.pathname === '/cho' && u.searchParams.has('q'));
  const first = buyer.getByTestId('market-card').first();
  await expect(first).toContainText(name);
  await expect(first).toContainText('Lâm Đồng');

  await buyer.getByRole('link', { name: /Nông sản/ }).click();
  await buyer.waitForURL((u) => u.searchParams.get('dm') === 'nong-san');
  expect(new URL(buyer.url()).searchParams.get('q')).toBe(`thanh long binh thuan ${stamp}`);
  await expect(buyer.getByTestId('market-card').first()).toContainText(name);

  // Link chia sẻ giữ nguyên kết quả.
  const shared = await browser.newPage();
  await shared.goto(buyer.url());
  await expect(shared.getByTestId('market-card').first()).toContainText(name);
  await shared.close();

  await buyer.getByTestId('market-card').first().getByRole('link').click();
  await buyer.waitForURL((u) => u.hostname === `${slug}.9mua.test`);
  await buyer.getByRole('button', { name: /Thêm vào giỏ/ }).click();
  await expect(buyer.getByTestId('cart-message')).toContainText('Đã thêm');

  await buyer.goto('/cho/nong-san');
  await expect(buyer.getByRole('heading', { level: 1 })).toContainText('Nông sản');
  expect((await buyer.goto('/cho/khong-co'))?.status()).toBe(404);
});
