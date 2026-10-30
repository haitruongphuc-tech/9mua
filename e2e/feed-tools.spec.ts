import { expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

// Công cụ xem video (SPEC-creator.md V5.2): thanh tua, tốc độ phát, tự cuộn.
test('có thanh tua, chọn tốc độ 1,5x và nhớ lại, bật tự cuộn thì video không lặp', async ({ browser }) => {
  test.setTimeout(60_000);
  const stamp = String(Date.now()).slice(-6);
  const page = await newBuyerPage(browser, `Xem ${stamp}`);
  await page.goto('/video/dang');
  await page.getByTestId('video-input').setInputFiles('tests/fixtures/videos/landscape.mp4');
  await page.getByTestId('video-caption').fill(`Công cụ xem ${stamp}`);
  await page.getByRole('button', { name: 'Đăng video' }).click();
  await page.waitForURL((u) => u.pathname === '/video/cua-toi');
  await page.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  const video = await e2eDb.video.findFirstOrThrow({ where: { caption: `Công cụ xem ${stamp}` } });

  await page.goto(`/v/${video.id}`);
  const item = page.getByTestId('feed-item').first();
  const el = item.locator('video');
  // Chromium của Playwright không giải mã được H.264 nên không phát thật: chỉ kiểm thanh tua có mặt và gắn đúng video.
  await expect(item.getByTestId('feed-seek')).toHaveAttribute('aria-label', 'Tua video');

  // Tốc độ trong nút ⋯, nhớ trong trình duyệt.
  await item.getByTestId('feed-report').click();
  await page.getByTestId('speed-1.5').click();
  await expect.poll(() => el.evaluate((v: HTMLVideoElement) => v.playbackRate)).toBe(1.5);
  await page.reload();
  await expect
    .poll(() =>
      page
        .getByTestId('feed-item')
        .first()
        .locator('video')
        .evaluate((v: HTMLVideoElement) => v.playbackRate),
    )
    .toBe(1.5);

  // Tự cuộn: tắt lặp lại.
  const first = page.getByTestId('feed-item').first();
  await expect(first.locator('video')).toHaveAttribute('loop', '');
  await first.getByTestId('feed-autoscroll').click();
  await expect(first.locator('video')).not.toHaveAttribute('loop', '');
  // Video ngang có nút Toàn màn hình.
  await expect(first.getByTestId('feed-fullscreen')).toBeVisible();

  // Lịch sử đã xem (SPEC-creator.md V5.2): gửi lượt xem 5 giây thay cho phát thật rồi mở trang lịch sử.
  const status = await page.evaluate(
    async (id) =>
      (
        await fetch('/api/video/views', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify([{ videoId: id, watchedSeconds: 5 }]),
        })
      ).status,
    video.id,
  );
  expect(status).toBeLessThan(300);
  await page.goto('/tai-khoan/lich-su-xem');
  await expect(page.getByTestId('history-list').getByRole('link')).toHaveCount(1);
  await page.getByTestId('history-clear').click();
  await expect(page.getByTestId('history-list')).toHaveCount(0);

  // Không quan tâm: video biến mất khỏi feed ngay.
  await page.goto(`/v/${video.id}`);
  await page.getByTestId('feed-item').first().getByTestId('feed-report').click();
  await page.getByTestId('feed-not-interested').click();
  await expect(page.getByTestId('feed-item').filter({ hasText: `Công cụ xem ${stamp}` })).toHaveCount(0);
});
