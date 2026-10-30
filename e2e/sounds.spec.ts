import { expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

const processVideos = (page: import('@playwright/test').Page) =>
  page.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });

// Âm thanh (SPEC-creator.md V5.6 mục 2): video công khai có tiếng tự có "Âm thanh gốc – @tên"; người khác bấm "Dùng âm
// thanh này", chỉnh âm lượng, đăng; trang /am-thanh/<id> đếm video dùng.
test('âm thanh gốc: dùng âm thanh của video người khác, trang âm thanh đếm video', async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = String(Date.now()).slice(-6);
  const owner = await newBuyerPage(browser, `Ca sĩ ${stamp}`);
  await owner.goto('/video/dang');
  await owner.getByTestId('video-input').setInputFiles('tests/fixtures/videos/landscape.mp4');
  await owner.getByTestId('video-caption').fill(`Có tiếng ${stamp}`);
  await owner.getByRole('button', { name: 'Đăng video' }).click();
  await owner.waitForURL((u) => u.pathname === '/video/cua-toi');
  await processVideos(owner);
  const source = await e2eDb.video.findFirstOrThrow({ where: { caption: `Có tiếng ${stamp}` } });
  const sound = await e2eDb.sound.findUniqueOrThrow({ where: { sourceVideoId: source.id } });

  const me = await newBuyerPage(browser, `Dùng nhạc ${stamp}`);
  await me.goto(`/v/${source.id}`);
  const item = me.getByTestId('feed-item').first();
  await expect(item.getByTestId('feed-sound')).toContainText(`Âm thanh gốc – @Ca sĩ ${stamp}`);
  await item.getByTestId('feed-report').click();
  await me.getByTestId('feed-use-sound').click();
  await me.waitForURL(`**/video/dang?sound=${sound.id}`);
  await expect(me.getByTestId('sound-picked')).toContainText(`Âm thanh gốc – @Ca sĩ ${stamp}`);
  await me.getByTestId('sound-volume').fill('60');
  await me.getByTestId('video-input').setInputFiles('tests/fixtures/videos/landscape.mp4');
  await me.getByTestId('video-caption').fill(`Dùng âm thanh ${stamp}`);
  await me.getByRole('button', { name: 'Đăng video' }).click();
  await me.waitForURL((u) => u.pathname === '/video/cua-toi' && u.searchParams.has('moi'));
  await processVideos(me);
  const used = await e2eDb.video.findFirstOrThrow({ where: { caption: `Dùng âm thanh ${stamp}` } });
  expect(used).toMatchObject({ status: 'ready', soundId: sound.id, soundVolume: 60, originalVolume: 100 });

  await me.goto(`/am-thanh/${sound.id}`);
  await expect(me.getByTestId('sound-title')).toHaveText(`Âm thanh gốc – @Ca sĩ ${stamp}`);
  await expect(me.getByTestId('sound-count')).toHaveText('1 video');
  await expect(me.getByTestId('video-grid').locator('li')).toHaveCount(2); // video gốc + video dùng lại
  await expect(me.getByTestId('sound-rename')).toHaveCount(0); // chỉ người đăng video gốc đổi tên được

  // Người đăng video gốc đổi tên âm thanh.
  await owner.goto(`/am-thanh/${sound.id}`);
  await owner.getByTestId('sound-rename-input').fill(`Bài hát ${stamp}`);
  await owner.getByRole('button', { name: 'Lưu tên' }).click();
  await expect(owner.getByRole('status')).toHaveText('Đã lưu tên âm thanh.');
  await owner.reload();
  await expect(owner.getByTestId('sound-title')).toHaveText(`Bài hát ${stamp}`);

  // Tìm trong bảng chọn âm thanh khi đăng.
  await me.goto('/video/dang');
  await me.getByTestId('sound-open').click();
  await me.getByTestId('sound-search').fill(`Bài hát ${stamp}`);
  await expect(me.getByTestId('sound-results').locator('li')).toHaveCount(1);
  await me.getByTestId('sound-choose').click();
  await expect(me.getByTestId('sound-picked')).toContainText(`Bài hát ${stamp}`);
  // Bảng âm thanh không đẩy trang rộng hơn màn hình điện thoại.
  expect(await me.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await me.evaluate(() => window.visualViewport!.width),
  );
});
