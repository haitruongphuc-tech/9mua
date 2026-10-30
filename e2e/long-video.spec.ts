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

    // Nhiều mức chất lượng (SPEC-creator.md V5.1): 3 ảnh bìa gợi ý, đổi ảnh bìa sau khi đăng, ảnh xem trước ở lưới.
    const ready = await e2eDb.video.findUniqueOrThrow({ where: { id: video.id } });
    expect(ready.posterChoices).toHaveLength(3);
    await page.goto(`/video/cua-toi/${video.id}/sua`);
    await expect(page.getByTestId('cover-choice')).toHaveCount(4); // ảnh bìa hiện tại + 3 ảnh gợi ý
    await page.getByTestId('cover-choice').nth(2).click();
    await expect(page.getByText('Đã đổi ảnh bìa.')).toBeVisible();
    expect((await e2eDb.video.findUniqueOrThrow({ where: { id: video.id } })).posterUrl).toBe(
      ready.posterChoices[1],
    );
    await page.goto(`/creator/${video.authorId}`);
    await expect(page.getByTestId('grid-preview').first()).toBeAttached();

    // Video dài 75 giây (tài khoản ≥ 3 ngày) → HLS; trang xem gắn trình phát HLS.
    await e2eDb.user.update({
      where: { id: video.authorId },
      data: { createdAt: new Date(Date.now() - 5 * 86_400_000) },
    });
    await page.goto('/video/dang');
    await page.getByTestId('video-input').setInputFiles('tests/fixtures/videos/long-75s.mp4');
    await page.getByTestId('video-caption').fill(`Dài 75 giây ${stamp}`);
    await page.getByRole('button', { name: 'Đăng video' }).click();
    await page.waitForURL((u) => u.pathname === '/video/cua-toi' && u.searchParams.has('moi'));
    await page.request.get('http://localhost:3100/api/internal/video/process', {
      headers: { 'x-internal-token': E2E_CRON_TOKEN },
    });
    const long = await e2eDb.video.findFirstOrThrow({ where: { caption: `Dài 75 giây ${stamp}` } });
    expect(long).toMatchObject({ status: 'ready', fileUrl: expect.stringMatching(/master\.m3u8$/) });
    await page.goto(`/v/${long.id}`);
    const el = page.getByTestId('feed-item').first().locator('video');
    await expect
      .poll(() => el.evaluate((v: HTMLVideoElement) => v.currentSrc || v.src))
      .toMatch(/^blob:|m3u8$/);
  } finally {
    await setSwitch('off');
  }
});
