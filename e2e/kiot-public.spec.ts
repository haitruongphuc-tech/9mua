import { expect, test } from '@playwright/test';
import { activateKiot } from './helpers/db';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

test('trang Kiot công khai: chủ xem trước bản nháp, khách thấy tạm ngưng, kích hoạt xong ai cũng xem được', async ({
  page,
  browser,
}) => {
  const { slug } = await signUpWithKiot(page, 'Vườn Thanh Long');
  await createProductViaUi(page, { name: 'Thanh long ruột đỏ 1kg', price: '45000' });
  await createProductViaUi(page, { name: 'Muối ớt Tây Ninh', price: '25000', stock: '0' });

  const port = new URL(page.url()).port;
  const kiotUrl = `http://${slug}.9mua.test:${port}`;

  // Chủ Kiot xem trước trên tên miền phụ (cookie dùng chung *.9mua.test).
  await page.goto(kiotUrl);
  await expect(page.getByTestId('preview-banner')).toBeVisible();
  await expect(page.getByTestId('product-grid').locator('li')).toHaveCount(2);

  // Khách chưa đăng nhập: Kiot nháp trả 404 "Kiot tạm ngưng".
  const guest = await browser.newPage();
  const draft = await guest.goto(kiotUrl);
  expect(draft?.status()).toBe(404);
  await expect(guest.getByRole('heading', { name: 'Kiot tạm ngưng' })).toBeVisible();

  await activateKiot(slug);
  const live = await guest.goto(kiotUrl);
  expect(live?.status()).toBe(200);
  await expect(guest.getByTestId('preview-banner')).toHaveCount(0);
  const cards = guest.getByTestId('product-grid').locator('li');
  await expect(cards.first()).toContainText('Thanh long ruột đỏ 1kg');
  await expect(cards.last()).toContainText('Hết hàng');

  // Trang sản phẩm trên tên miền phụ + thẻ Open Graph để chia sẻ Zalo/Facebook.
  await cards.first().getByRole('link').click();
  await guest.waitForURL(new RegExp(`^${kiotUrl}/p/[^/]+-thanh-long-ruot-do-1kg$`));
  await expect(guest.getByTestId('product-price')).toHaveText('45.000đ');
  await expect(guest.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'Thanh long ruột đỏ 1kg — 45.000đ',
  );
  await expect(guest.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /\/uploads\/products\/.+\.webp$/,
  );
  const productUrl = guest.url();

  // Cùng sản phẩm qua 9mua.test/k/<slug>/p/…
  await guest.goto(`/k/${slug}${new URL(productUrl).pathname}`);
  await expect(guest.getByTestId('product-price')).toHaveText('45.000đ');

  // Đường dẫn khác trên tên miền phụ chuyển về tên miền chính.
  await guest.goto(`${kiotUrl}/dang-nhap`);
  await expect(guest).toHaveURL(/^http:\/\/9mua\.test:\d+\/dang-nhap$/);

  // QR trang Kiot cho chủ Kiot.
  await page.goto('/kiot-cua-toi');
  const qrType = await page.evaluate(async () => (await fetch('/api/kiot/qr')).headers.get('content-type'));
  expect(qrType).toBe('image/png');
  await guest.close();
});
