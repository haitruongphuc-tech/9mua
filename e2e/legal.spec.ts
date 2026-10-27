import { expect, test } from '@playwright/test';

// SPEC-marketplace.md bổ sung 27/10: Giới thiệu & Pháp lý + 7 trang chính sách, link ở chân trang.
test('chân trang → Giới thiệu & Pháp lý → chính sách có số liệu thật', async ({ page }) => {
  await page.goto('/cho');
  const footer = page.getByTestId('footer-links');
  await expect(footer.getByRole('link')).toHaveCount(8);
  await footer.getByRole('link', { name: 'Giới thiệu & Pháp lý' }).click();
  await expect(page).toHaveURL(/\/gioi-thieu$/);
  await expect(page.getByTestId('page-slogan')).toHaveText('99% AI vận hành - 1% CEO phê duyệt - Người thật');
  const info = page.getByTestId('company-info');
  await expect(info).toContainText('9MUA CO.,LTD');
  await expect(info).toContainText('3401295437');
  await expect(info.getByRole('link', { name: 'Xem bản đồ →' }).first()).toHaveAttribute(
    'href',
    /google\.com\/maps/,
  );
  await page.getByTestId('policy-links').getByRole('link', { name: 'Thanh toán' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chính sách thanh toán');
  const policy = page.getByTestId('policy');
  await expect(policy).toContainText('phí sàn 5%');
  await expect(policy).toContainText('/năm');
  await expect(policy).not.toContainText('{');
  expect((await page.goto('/chinh-sach/khong-co'))?.status()).toBe(404);
});

test.describe('trình duyệt tiếng Anh', () => {
  test.use({ locale: 'en-US' });
  test('chính sách có bản tiếng Anh', async ({ page }) => {
    await page.goto('/chinh-sach/bao-mat');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy');
    await expect(page.getByTestId('policy-fallback')).toHaveCount(0);
  });
});

test.describe('trình duyệt tiếng Nhật', () => {
  test.use({ locale: 'ja-JP' });
  test('chưa có bản dịch thì hiện tiếng Việt kèm dòng báo', async ({ page }) => {
    await page.goto('/chinh-sach/bao-mat');
    await expect(page.getByTestId('policy-fallback')).toHaveText(
      'このページはまだ翻訳されていません。以下はベトナム語版です。',
    );
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chính sách bảo mật thông tin');
  });
});
