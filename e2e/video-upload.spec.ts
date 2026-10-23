import { expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { signUpBuyer } from './helpers/orders';

test('đăng video iPhone: thanh tiến trình → đang xử lý → worker chuyển mã → đã đăng', async ({ browser }) => {
  const page = await signUpBuyer(browser, 'Creator E2E');
  await page.goto('/video/dang');
  await page.getByTestId('video-input').setInputFiles('tests/fixtures/videos/iphone-hevc.mov');
  await page.getByTestId('video-caption').fill('Thanh long Bình Thuận #thanhlong');
  await page.getByRole('button', { name: 'Đăng video' }).click();
  await page.waitForURL((u) => u.pathname === '/video/cua-toi' && u.searchParams.has('moi'));
  await expect(page.getByTestId('my-video-status').first()).toHaveText('Đang xử lý…');

  const res = await page.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  expect(await res.json()).toMatchObject({ processed: expect.any(Number) });
  await page.reload();
  await expect(page.getByTestId('my-video-status').first()).toHaveText('Đã đăng');

  // File giả đuôi .mp4 bị từ chối.
  await page.goto('/video/dang');
  await page.getByTestId('video-input').setInputFiles('tests/fixtures/videos/fake.mp4');
  await page.getByRole('button', { name: 'Đăng video' }).click();
  await expect(page.getByTestId('video-error')).toHaveText('File không phải video MP4, MOV hoặc WebM.');
});
