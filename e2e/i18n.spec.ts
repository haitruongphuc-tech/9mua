import { expect, test } from '@playwright/test';
import { activateKiot } from './helpers/db';
import { createProductViaUi } from './helpers/products';
import { signUpWithKiot } from './helpers/seller';

// SPEC-i18n.md: tự chọn theo ngôn ngữ trình duyệt; chọn tay thì nhớ bằng cookie dùng chung cho trang Kiot.
test.describe('trình duyệt tiếng Nhật', () => {
  test.use({ locale: 'ja-JP' });
  test('lần đầu vào web tự hiện tiếng Nhật', async ({ page }) => {
    await page.goto('/cho');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
    const nav = page.getByRole('navigation', { name: 'メインナビゲーション' });
    await expect(nav.getByRole('link')).toHaveText(['動画', 'マーケット', 'ライブ', 'Kiot', 'マイページ']);
    await expect(page.getByTestId('page-slogan')).toHaveText('すべてのKiotがショールーム - 9MUAがつなぐ');
  });
});

test('chọn English → giữ khi tải lại và sang trang Kiot; giá vẫn VNĐ', async ({ page, browser }) => {
  const { slug } = await signUpWithKiot(page, 'Kiot Ngôn Ngữ');
  await createProductViaUi(page, { name: 'Cà phê Đắk Lắk', price: '120000' });
  await activateKiot(slug);
  const port = new URL(page.url()).port;

  const guest = await browser.newPage({ locale: 'vi-VN' });
  await guest.goto('/live');
  await expect(guest.getByTestId('page-slogan')).toHaveText('Nhìn thật - Mua thật - Người thật việc thật');
  await guest.getByTestId('lang-button').click();
  await guest.getByRole('menuitemradio', { name: 'English' }).click();
  const nav = guest.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link')).toHaveText(['Video', 'Market', 'Live', 'Kiot', 'Me']);
  await expect(guest.getByTestId('page-slogan')).toHaveText('See real - Buy real - Real people');
  await expect(guest.getByRole('heading', { name: 'Nobody is live right now' })).toBeVisible();
  await expect(guest.getByTestId('lang-button')).toHaveText('EN');

  await guest.reload();
  await expect(guest.locator('html')).toHaveAttribute('lang', 'en');

  await guest.goto(`http://${slug}.9mua.test:${port}`);
  await expect(guest.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(guest.getByTestId('page-slogan')).toHaveText('Every Kiot is a brand - A CEO behind it');
  await expect(guest.getByTestId('product-grid')).toContainText('120.000đ');
});
