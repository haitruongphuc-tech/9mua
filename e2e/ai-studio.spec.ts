import { expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { activateKiot, e2eDb } from './helpers/db';
import { signUpBuyer } from './helpers/orders';
import { signUpWithKiot } from './helpers/seller';

// SPEC-ai.md (driver AI giả khi TEST_MODE=e2e): chủ Kiot mở AI Studio → tạo → chọn ảnh → ghép video → đăng bán
// → sản phẩm có trên trang Kiot, video vào hàng đợi feed.
test.beforeAll(async () => {
  // Database E2E dùng lâu ngày: nâng ngân sách để các lần chạy trước không làm AI "chạm ngân sách".
  await e2eDb.setting.upsert({
    where: { key: 'ai_monthly_budget_vnd' },
    create: { key: 'ai_monthly_budget_vnd', value: '100000000' },
    update: { value: '100000000' },
  });
});

test('AI Studio: tạo mô tả + 4 ảnh, ghép video 10 giây, đăng bán lên Kiot', async ({ page }) => {
  test.setTimeout(120_000);
  const { slug } = await signUpWithKiot(page, 'Kiot AI');
  await activateKiot(slug);

  await page.goto('/ai');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '5 kỹ thuật - AI viết, vẽ, làm video - ArtCraft vẽ tương lai',
  );
  await expect(page.getByTestId('ai-quota')).toHaveText('Hôm nay còn 10 lượt viết · 3 lượt vẽ');
  await page.getByTestId('ai-name').fill('Mực một nắng Hamubay');
  await page.getByTestId('ai-price').fill('350000');
  await page.getByTestId('ai-category').selectOption('thuc-pham-dac-san');
  await page.getByTestId('ai-note').fill('Mực câu Phan Thiết, phơi đúng một nắng');
  await page.getByTestId('ai-style-neon').click();
  await expect(page.getByTestId('ai-style-neon')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('ai-generate').click();

  await expect(page.getByTestId('ai-image')).toHaveCount(4);
  await expect(page.getByTestId('ai-description')).toHaveValue(/ĐIỂM NỔI BẬT/);
  await expect(page.getByTestId('ai-quota')).toHaveText('Hôm nay còn 9 lượt viết · 2 lượt vẽ');
  // Bỏ chọn ảnh số 2: còn 3 ảnh, ảnh đầu là ảnh chính.
  await page.getByTestId('ai-image').nth(1).click();
  await expect(page.getByTestId('ai-image').nth(1)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('ai-image').first()).toContainText('Ảnh chính');

  await page.getByTestId('ai-make-video').click();
  await expect(page.getByTestId('ai-make-video')).toHaveText('Đang ghép video…');
  const res = await page.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  expect((await res.json()).processed).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId('ai-video')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('ai-with-video')).toBeChecked();

  await page.getByTestId('ai-stock').fill('25');
  await page.getByTestId('ai-publish').click();
  await expect(page.getByTestId('ai-published')).toContainText('Đã đăng bán “Mực một nắng Hamubay”.');
  await expect(page.getByTestId('ai-published')).toContainText('Video đang được xử lý');

  // Sản phẩm có trên trang Kiot công khai, đúng giá, 3 ảnh.
  await page.getByRole('link', { name: 'Xem sản phẩm' }).click();
  await expect(page.getByRole('heading', { name: 'Mực một nắng Hamubay' })).toBeVisible();
  await expect(page.getByText('350.000đ').first()).toBeVisible();
  const product = await e2eDb.product.findFirstOrThrow({
    where: { kiot: { slug } },
    include: { images: true },
  });
  expect(product).toMatchObject({ price: 350_000, stock: 25, category: 'thuc-pham-dac-san' });
  expect(product.images).toHaveLength(3);
  await page.goto(`http://${slug}.9mua.test:3100/`);
  await expect(page.getByText('Mực một nắng Hamubay').first()).toBeVisible();

  // Video gắn sẵn sản phẩm: worker chuyển mã xong thì lên feed.
  await page.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  await page.goto('/video/cua-toi');
  await expect(page.getByTestId('my-video-status').first()).toHaveText('Đã đăng');
});

test('AI Studio khoá với người chưa có Kiot đang hoạt động', async ({ browser }) => {
  const buyer = await signUpBuyer(browser, 'Khách AI');
  await buyer.goto('/ai');
  await expect(buyer.getByTestId('ai-locked')).toContainText('Dành cho chủ Kiot đang hoạt động.');
  await expect(buyer.getByRole('link', { name: 'Mở Kiot để dùng AI Studio' })).toHaveAttribute(
    'href',
    '/kiot-cua-toi',
  );
  await expect(buyer.getByTestId('ai-generate')).toHaveCount(0);
});
