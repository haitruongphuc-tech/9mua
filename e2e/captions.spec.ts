import { expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

const SWITCH = 'feature.auto_captions';
const setSwitch = (value: 'on' | 'off') =>
  e2eDb.setting.upsert({ where: { key: SWITCH }, create: { key: SWITCH, value }, update: { value } });

// Phụ đề tự động (SPEC-creator.md V5.4), driver fake ở E2E. Công tắc chung nên chỉ chạy ở dự án điện thoại.
test('bật phụ đề khi đăng → sửa chữ, bật cho người xem → nút CC trên video', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'công tắc chung, chạy một lần');
  test.setTimeout(90_000);
  await setSwitch('on');
  try {
    const stamp = String(Date.now()).slice(-6);
    const page = await newBuyerPage(browser, `Phụ đề ${stamp}`);
    await page.goto('/video/dang');
    await page.getByTestId('video-input').setInputFiles('tests/fixtures/videos/landscape.mp4');
    await page.getByTestId('video-caption').fill(`Có phụ đề ${stamp}`);
    await page.getByTestId('video-auto-captions').check();
    await page.getByRole('button', { name: 'Đăng video' }).click();
    await page.waitForURL((u) => u.pathname === '/video/cua-toi' && u.searchParams.has('moi'));
    await page.request.get('http://localhost:3100/api/internal/video/process', {
      headers: { 'x-internal-token': E2E_CRON_TOKEN },
    });
    const video = await e2eDb.video.findFirstOrThrow({ where: { caption: `Có phụ đề ${stamp}` } });
    await page.goto('/video/cua-toi');
    await page
      .getByTestId('my-video')
      .filter({ hasText: `Có phụ đề ${stamp}` })
      .getByTestId('edit-captions')
      .click();
    await expect(page.getByTestId('captions-status')).toContainText('Đã tạo xong');
    await page.getByTestId('captions-text').fill('WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nXin chào 9MUA\n');
    await page.getByTestId('captions-publish').check();
    await page.getByTestId('captions-save').click();
    await expect(page.getByText('Đã lưu phụ đề.')).toBeVisible();

    await page.goto(`/v/${video.id}`);
    const item = page.getByTestId('feed-item').first();
    await item.getByTestId('feed-cc').click();
    await expect(item.getByTestId('feed-cc')).toHaveAttribute('aria-pressed', 'true');
    const vtt = await page.evaluate(async (id) => (await fetch(`/api/video/${id}/phu-de`)).text(), video.id);
    expect(vtt).toContain('Xin chào 9MUA');
  } finally {
    await setSwitch('off');
  }
});
