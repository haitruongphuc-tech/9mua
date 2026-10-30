import { expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';
import { fakeCamera } from './helpers/camera';

// Quay trong app (SPEC-creator.md V5.5), camera giả của Chromium: 2 đoạn (1x và 2x), xoá rồi quay lại, bộ lọc Đen trắng.
test('quay 2 đoạn trong app, chọn bộ lọc, đăng → máy chủ ghép và xử lý', async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = String(Date.now()).slice(-6);
  const page = await newBuyerPage(browser, `Quay ${stamp}`);
  await fakeCamera(page);
  await page.goto('/video/dang');
  // Hàng 8 bộ lọc cuộn ngang trong khung, không đẩy trang rộng hơn màn hình điện thoại.
  await expect(page.getByTestId('video-looks')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.visualViewport!.width),
  );
  await page.getByTestId('camera-open').click();
  const record = page.getByTestId('camera-record');
  const hold = async (ms: number) => {
    await record.dispatchEvent('pointerdown');
    await page.waitForTimeout(ms);
    await record.dispatchEvent('pointerup');
  };
  await hold(1200);
  await expect(page.getByTestId('camera-time')).toContainText('1 đoạn');
  await page.getByTestId('camera-speed-2').click();
  await hold(1200);
  await expect(page.getByTestId('camera-time')).toContainText('2 đoạn');
  // Xoá đoạn cuối rồi quay lại.
  await page.getByTestId('camera-delete').click();
  await expect(page.getByTestId('camera-time')).toContainText('1 đoạn');
  await hold(1200);
  await page.getByTestId('camera-done').click();
  await expect(page.getByTestId('recorded-info')).toContainText('Đã quay 2 đoạn');

  await page.getByTestId('look-den-trang').click();
  await page.getByTestId('video-caption').fill(`Quay trong app ${stamp}`);
  await page.getByRole('button', { name: 'Đăng video' }).click();
  await page.waitForURL((u) => u.pathname === '/video/cua-toi' && u.searchParams.has('moi'));
  const video = await e2eDb.video.findFirstOrThrow({ where: { caption: `Quay trong app ${stamp}` } });
  expect(video.look).toBe('den-trang');
  await page.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  const done = await e2eDb.video.findUniqueOrThrow({ where: { id: video.id } });
  expect(done.status).toBe('ready');
  expect(done.height).toBe(1280);
});

// Stitch (SPEC-creator.md V5.5 mục 4): từ nút ⋯ của video người khác, chọn đoạn 1 giây, chọn video của mình, đăng.
test('Stitch: chọn đoạn của video gốc + video của mình → nhãn "Stitch @tên"', async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = String(Date.now()).slice(-6);
  const owner = await newBuyerPage(browser, `Gốc ${stamp}`);
  await owner.goto('/video/dang');
  await owner.getByTestId('video-input').setInputFiles('tests/fixtures/videos/landscape.mp4');
  await owner.getByTestId('video-caption').fill(`Video gốc ${stamp}`);
  await owner.getByRole('button', { name: 'Đăng video' }).click();
  await owner.waitForURL((u) => u.pathname === '/video/cua-toi');
  await owner.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  const original = await e2eDb.video.findFirstOrThrow({ where: { caption: `Video gốc ${stamp}` } });

  const me = await newBuyerPage(browser, `Stitch ${stamp}`);
  await me.goto(`/v/${original.id}`);
  await me.getByTestId('feed-item').first().getByTestId('feed-report').click();
  await me.getByTestId('feed-stitch').click();
  await me.waitForURL(`**/video/dang?stitch=${original.id}`);
  await expect(me.getByTestId('stitch-picker')).toContainText(`Stitch với @Gốc ${stamp}`);
  await me.getByTestId('stitch-len-1').click();
  await me.getByTestId('video-input').setInputFiles('tests/fixtures/videos/landscape.mp4');
  await me.getByTestId('video-caption').fill(`Có Stitch ${stamp}`);
  await me.getByRole('button', { name: 'Đăng video' }).click();
  await me.waitForURL((u) => u.pathname === '/video/cua-toi' && u.searchParams.has('moi'));
  await me.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  const v = await e2eDb.video.findFirstOrThrow({ where: { caption: `Có Stitch ${stamp}` } });
  expect(v).toMatchObject({ status: 'ready', stitchOfId: original.id, stitchFromSec: 0, stitchToSec: 1 });
  await me.goto(`/v/${v.id}`);
  await expect(me.getByTestId('feed-item').first().getByTestId('feed-stitch-label')).toContainText(
    `Stitch @Gốc ${stamp}`,
  );
});
