import { expect, test, type Page } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

const processQueue = (page: Page) =>
  page.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });

async function postEpisode(page: Page, caption: string, title: string, episode: number, watchOnly = false) {
  await page.goto('/video/dang');
  await page.getByTestId('video-input').setInputFiles('tests/fixtures/videos/landscape.mp4');
  await page.getByTestId('video-series-select').selectOption({ label: title });
  await page.getByTestId('video-series-episode').fill(String(episode));
  if (watchOnly) await page.getByTestId('video-series-watch-only').check();
  await page.getByTestId('video-caption').fill(caption);
  await page.getByRole('button', { name: 'Đăng video' }).click();
  await page.waitForURL((u) => u.pathname === '/video/cua-toi');
}

// Watch (SPEC-creator.md V5.9): tạo phim, đăng 2 tập (tập 2 chỉ hiện trong Watch), người xem lưu phim, bình luận theo
// phút, đánh dấu tập đã xem.
test('Watch: tạo phim, đăng tập, lưu phim, bình luận theo phút, tập đã xem', async ({ browser }) => {
  test.setTimeout(120_000);
  const stamp = String(Date.now()).slice(-6);
  const title = `Phim ngắn ${stamp}`;
  const owner = await newBuyerPage(browser, `Đạo diễn ${stamp}`);
  await owner.goto('/video/cua-toi');
  await owner.getByTestId('my-series-link').click();
  await owner.waitForURL('**/video/cua-toi/phim');
  const create = owner.getByTestId('series-create');
  await create.locator('input[name="title"]').fill(title);
  await create.locator('textarea[name="description"]').fill('Chuyện nhà bán mực');
  await create.locator('select[name="genre"]').selectOption('gia-dinh');
  await create.getByRole('button', { name: 'Tạo phim' }).click();
  await owner.waitForURL(/\/video\/cua-toi\/phim\/[^/?]+\?moi=1/);
  const series = await e2eDb.series.findFirstOrThrow({ where: { title } });

  await postEpisode(owner, `Tập một ${stamp}`, title, 1);
  await postEpisode(owner, `Tập hai ${stamp}`, title, 2, true);
  await processQueue(owner);
  const eps = await e2eDb.video.findMany({ where: { seriesId: series.id }, orderBy: { episodeNo: 'asc' } });
  expect(eps.map((v) => [v.episodeNo, v.watchOnly, v.status])).toEqual([
    [1, false, 'ready'],
    [2, true, 'ready'],
  ]);

  const fan = await newBuyerPage(browser, `Mọt phim ${stamp}`);
  await fan.goto('/');
  await fan.getByTestId('feed-tab-watch').first().click();
  await fan.waitForURL('**/watch');
  await fan.getByTestId('watch-row-latest').getByTestId('watch-card').filter({ hasText: title }).click();
  await fan.waitForURL(`**/watch/${series.id}`);
  await expect(fan.getByTestId('series-title')).toHaveText(title);
  await expect(fan.getByTestId('watch-episode')).toHaveCount(2);
  await expect(fan.getByTestId('watch-current')).toHaveText('Tập 1');

  await fan.getByTestId('watch-save').click();
  await expect(fan.getByTestId('watch-save')).toContainText('Đã lưu phim');
  expect(await e2eDb.seriesFollow.count({ where: { seriesId: series.id } })).toBe(1);

  await fan.getByTestId('watch-comment-input').fill(`Đoạn này hay ${stamp}`);
  await fan.getByTestId('watch-comment-send').click();
  await expect(fan.getByTestId('watch-comment').first()).toContainText(`Đoạn này hay ${stamp}`);
  await expect(fan.getByTestId('watch-comment-at').first()).toHaveText('0:00');

  // Xem gần hết tập 1 (Chromium thử nghiệm không phát H.264 nên báo giây xem qua API như trình phát vẫn gửi).
  const r = await fan.evaluate(
    (videoId) =>
      fetch('/api/watch/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, second: 1.95 }),
      }).then((x) => x.json()),
    eps[0]!.id,
  );
  expect(r).toEqual({ ok: true, watched: true });
  await fan.reload();
  await expect(fan.getByTestId('watch-episode').first().getByLabel('Đã xem')).toBeVisible();
  await fan.getByTestId('watch-episode').nth(1).click();
  await expect(fan.getByTestId('watch-current')).toHaveText('Tập 2');
  // Bảng phim không đẩy trang rộng hơn màn hình điện thoại.
  expect(await fan.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await fan.evaluate(() => window.visualViewport!.width),
  );
});
