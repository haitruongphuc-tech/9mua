import { expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

const SWITCH = 'feature.long_video';
const setSwitch = (value: 'on' | 'off') =>
  e2eDb.setting.upsert({ where: { key: SWITCH }, create: { key: SWITCH, value }, update: { value } });

// Bật video dài (SPEC-creator.md V5.1): trình duyệt tải từng phần 8MB qua /api/uploads/video rồi tạo video như cũ.
// Công tắc là chung cho cả web nên chỉ chạy ở một dự án (điện thoại) để hai dự án không bật/tắt chồng nhau.
test('bật video dài: tải từng phần → ghép → worker chuyển mã → đã đăng', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'công tắc chung, chạy một lần');
  test.setTimeout(90_000);
  await setSwitch('on');
  try {
    const stamp = String(Date.now()).slice(-6);
    const page = await newBuyerPage(browser, `Dài ${stamp}`);
    await page.goto('/video/dang');
    await page.getByTestId('video-input').setInputFiles('tests/fixtures/videos/landscape.mp4');
    await page.getByTestId('video-caption').fill(`Từng phần ${stamp}`);
    const opened = page.waitForResponse(
      (r) => r.url().endsWith('/api/uploads/video') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Đăng video' }).click();
    expect((await opened).status()).toBe(200);
    await page.waitForURL((u) => u.pathname === '/video/cua-toi' && u.searchParams.has('moi'));
    const video = await e2eDb.video.findFirstOrThrow({ where: { caption: `Từng phần ${stamp}` } });
    expect(await e2eDb.videoUploadSession.count({ where: { userId: video.authorId, status: 'done' } })).toBe(
      1,
    );
    await page.request.get('http://localhost:3100/api/internal/video/process', {
      headers: { 'x-internal-token': E2E_CRON_TOKEN },
    });
    await page.reload();
    await expect(
      page
        .getByTestId('my-video')
        .filter({ hasText: `Từng phần ${stamp}` })
        .getByTestId('my-video-status'),
    ).toContainText('Đã đăng');
  } finally {
    await setSwitch('off');
  }
});
