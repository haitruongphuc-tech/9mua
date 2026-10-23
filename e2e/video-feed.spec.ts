import { devices, expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { activateKiot, e2eDb } from './helpers/db';
import { signUpBuyer } from './helpers/orders';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

// Giả lập iPhone (khung hình, cảm ứng, user agent) trên Chromium.
const iPhone = devices['iPhone 13'];
test.use({
  browserName: 'chromium',
  viewport: iPhone.viewport,
  userAgent: iPhone.userAgent,
  deviceScaleFactor: iPhone.deviceScaleFactor,
  isMobile: iPhone.isMobile,
  hasTouch: iPhone.hasTouch,
});

async function processVideos(page: import('@playwright/test').Page) {
  await page.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
}

test('đăng video gắn sản phẩm → feed → vuốt → thẻ sản phẩm → giỏ có sourceVideoId', async ({
  page,
  browser,
}) => {
  const stamp = String(Date.now()).slice(-6);
  const { slug } = await signUpWithKiot(page, 'Kiot Video');
  await activateKiot(slug);
  const productName = `Mật ong rừng ${stamp}`;
  await createProductViaUi(page, { name: productName, price: '150000', category: 'thuc-pham-dac-san' });

  const creator = await signUpBuyer(browser, 'Creator Feed');
  for (const caption of [`Video phụ ${stamp}`, `Mật ong ngon ${stamp} #matong`]) {
    await creator.goto('/video/dang');
    await creator.getByTestId('video-input').setInputFiles('tests/fixtures/videos/iphone-hevc.mov');
    await creator.getByTestId('video-caption').fill(caption);
    if (caption.startsWith('Mật ong')) {
      await creator.getByTestId('video-product-search').fill(`mat ong rung ${stamp}`);
      await creator
        .getByTestId('video-product-results')
        .getByRole('button', { name: new RegExp(productName) })
        .click();
    }
    await creator.getByRole('button', { name: 'Đăng video' }).click();
    await creator.waitForURL((u) => u.pathname === '/video/cua-toi');
  }
  await processVideos(creator);
  const video = await e2eDb.video.findFirstOrThrow({ where: { caption: `Mật ong ngon ${stamp} #matong` } });
  expect(video.status).toBe('ready');

  await creator.goto(`/v/${video.id}`);
  const items = creator.getByTestId('feed-item');
  await expect(items.first()).toContainText(`Mật ong ngon ${stamp}`);
  await expect(items.first().getByTestId('feed-products')).toContainText(productName);
  expect(await items.count()).toBeGreaterThan(1);

  // Vuốt lên sang video kế rồi vuốt về.
  await creator.getByTestId('video-feed').evaluate((el) => el.scrollBy(0, el.clientHeight));
  await expect(items.nth(1)).toBeInViewport();
  await creator.getByTestId('video-feed').evaluate((el) => el.scrollTo(0, 0));
  await expect(items.first()).toBeInViewport();

  await items.first().getByTestId('feed-like').click();
  await expect(items.first().getByTestId('feed-likes')).toHaveText('1');

  await items.first().getByTestId('feed-add-to-cart').click();
  await expect(creator.getByTestId('feed-toast')).toHaveText('Đã thêm vào giỏ hàng.');
  const user = await e2eDb.video.findUniqueOrThrow({ where: { id: video.id }, select: { authorId: true } });
  expect(await e2eDb.cartItem.findFirstOrThrow({ where: { userId: user.authorId } })).toMatchObject({
    sourceVideoId: video.id,
  });

  // Link chia sẻ có thẻ Open Graph với ảnh bìa.
  await expect(creator.locator('meta[property="og:image"]')).toHaveAttribute('content', /\.jpg$/);
  await expect(creator.locator('meta[property="og:type"]')).toHaveAttribute('content', 'video.other');
});
