import { readFileSync } from 'node:fs';
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

// Chỉnh video (SPEC-creator.md V5.6 mục 1). File WebM: Chromium của Playwright không đọc H.264 nên không đo được thời
// lượng MP4 (Chrome thật đọc được). Ghép thêm một file và đổi thứ tự, cắt đầu, chữ kéo tới góc trên, nhãn dán.
test('chỉnh video: ghép 2 đoạn, đổi thứ tự, cắt đầu, chữ, nhãn dán → máy chủ dựng theo editSpec', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const stamp = String(Date.now()).slice(-6);
  const page = await newBuyerPage(browser, `Chỉnh ${stamp}`);
  await page.goto('/video/dang');
  await page.getByTestId('video-input').setInputFiles('tests/fixtures/videos/clip.webm');
  await expect(page.getByTestId('video-editor')).toBeVisible();
  await page.getByTestId('edit-add-clip').setInputFiles({
    name: 'doan-hai.webm',
    mimeType: 'video/webm',
    buffer: readFileSync('tests/fixtures/videos/clip.webm'),
  });
  const clips = page.getByTestId('edit-clip');
  await expect(clips).toHaveCount(2);
  await expect(clips.nth(1)).toContainText('doan-hai.webm');
  await clips.nth(1).getByTestId('edit-clip-up').click();
  await expect(clips.first()).toContainText('doan-hai.webm');
  // Đo xong thời lượng 2 đoạn (2 + 2 giây) thì có thanh cắt.
  await expect(clips.nth(1)).toContainText('2.0s');
  await page.getByTestId('trim-start').fill('0.5');

  await page.getByTestId('edit-text-input').fill('Chào 9MUA 100%');
  await page.getByTestId('edit-color-ffd400').click();
  await page.getByTestId('edit-text-add').click();
  await page.getByTestId('edit-stickers').click();
  await page.getByTestId('sticker-mua-ngay').click();
  await expect(page.getByTestId('overlay-sticker')).toHaveText('Mua ngay');
  // Kéo chữ lên góc trên bên trái khung xem trước.
  const text = page.getByTestId('overlay-text');
  await expect(text).toHaveText('Chào 9MUA 100%');
  // Đưa khung xem trước ra giữa màn hình (không nằm dưới thanh nút đăng dính ở đáy).
  await page.getByTestId('video-preview').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const from = (await text.boundingBox())!;
  const frame = (await page.getByTestId('video-preview').boundingBox())!;
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const end = { x: frame.x + frame.width * 0.25, y: frame.y + frame.height * 0.15 };
  if (test.info().project.name === 'mobile-chromium') {
    // Điện thoại: kéo bằng ngón tay (sự kiện chạm thật của Chromium), không phải chuột.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    for (let i = 1; i <= 5; i++)
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: start.x + ((end.x - start.x) * i) / 5, y: start.y + ((end.y - start.y) * i) / 5 }],
      });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 5 });
    await page.mouse.up();
  }
  // Bảng chỉnh không làm trang rộng hơn màn hình điện thoại.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.visualViewport!.width),
  );

  await page.getByTestId('video-caption').fill(`Đã chỉnh ${stamp}`);
  await page.getByRole('button', { name: 'Đăng video' }).click();
  await page.waitForURL((u) => u.pathname === '/video/cua-toi' && u.searchParams.has('moi'));
  const video = await e2eDb.video.findFirstOrThrow({ where: { caption: `Đã chỉnh ${stamp}` } });
  const spec = video.editSpec as {
    trimStart: number;
    texts: { text: string; color: string; x: number; y: number }[];
    stickers: { id: string }[];
  };
  expect(spec.trimStart).toBe(0.5);
  expect(spec.texts[0]).toMatchObject({ text: 'Chào 9MUA 100%', color: '#ffd400' });
  expect(spec.texts[0]!.x).toBeLessThan(0.4);
  expect(spec.texts[0]!.y).toBeLessThan(0.3);
  expect(spec.stickers.map((s) => s.id)).toEqual(['mua-ngay']);
  await page.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  const done = await e2eDb.video.findUniqueOrThrow({ where: { id: video.id } });
  expect(done.status).toBe('ready');
  // 2 đoạn × 2 giây, cắt 0,5 giây đầu.
  expect(done.durationSec).toBeGreaterThanOrEqual(3);
  expect(done.durationSec).toBeLessThanOrEqual(4);
});
