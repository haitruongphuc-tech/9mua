import { expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

// Nháp, địa điểm, nhãn AI, ghim lên trang cá nhân, sửa sau khi đăng (SPEC-creator.md V5.3).
test('lưu nháp có địa điểm và nhãn AI → đăng nháp → ghim → sửa chú thích hiện "Đã chỉnh sửa"', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const stamp = String(Date.now()).slice(-6);
  const page = await newBuyerPage(browser, `Nháp ${stamp}`);
  await page.goto('/video/dang');
  await page.getByTestId('video-input').setInputFiles('tests/fixtures/videos/landscape.mp4');
  await page.getByTestId('video-caption').fill(`Nháp thử ${stamp}`);
  await page.getByTestId('video-province').selectOption('da-nang');
  await page.getByTestId('video-place').fill('Chợ Hàn');
  await page.getByTestId('video-ai').check();
  await page.getByTestId('video-save-draft').click();
  await page.waitForURL((u) => u.pathname === '/video/cua-toi' && u.searchParams.get('tab') === 'nhap');
  await page.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  await page.reload();
  const draft = page.getByTestId('my-video').filter({ hasText: `Nháp thử ${stamp}` });
  await expect(draft.getByTestId('my-video-status')).toContainText('Nháp');
  const video = await e2eDb.video.findFirstOrThrow({ where: { caption: `Nháp thử ${stamp}` } });
  expect(video).toMatchObject({
    status: 'draft',
    province: 'da-nang',
    placeName: 'Chợ Hàn',
    aiGenerated: true,
  });

  // Đăng nháp: rời tab Nháp, lên feed.
  await draft.getByTestId('publish-now').click();
  await expect(page.getByTestId('my-video').filter({ hasText: `Nháp thử ${stamp}` })).toHaveCount(0);
  await page.goto('/video/cua-toi');
  await expect(
    page
      .getByTestId('my-video')
      .filter({ hasText: `Nháp thử ${stamp}` })
      .getByTestId('my-video-status'),
  ).toContainText('Đã đăng');

  await page.goto(`/v/${video.id}`);
  const item = page.getByTestId('feed-item').first();
  await expect(item.getByTestId('feed-ai-label')).toHaveText('✨ Nội dung tạo bằng AI');
  await expect(item.getByTestId('feed-place')).toHaveText('📍 Đà Nẵng · Chợ Hàn');

  // Ghim lên trang cá nhân từ nút ⋯.
  await item.getByTestId('feed-report').click();
  await page.getByTestId('feed-pin-profile').click();
  await expect(page.getByText('Đã ghim lên trang cá nhân.')).toBeVisible();
  await expect
    .poll(async () => (await e2eDb.video.findUniqueOrThrow({ where: { id: video.id } })).profilePinnedAt)
    .not.toBeNull();

  // Sửa chú thích sau khi đăng.
  await item.getByTestId('feed-report').click();
  await page.getByTestId('feed-edit-video').click();
  await page.waitForURL(`**/video/cua-toi/${video.id}/sua`);
  await page.getByTestId('edit-caption').fill(`Đã sửa ${stamp} #moi`);
  await page.getByTestId('edit-save').click();
  await page.waitForURL((u) => u.pathname === '/video/cua-toi' && u.searchParams.has('sua'));
  await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible();
  await page.goto(`/v/${video.id}`);
  await expect(page.getByTestId('feed-item').first().getByTestId('feed-place')).toHaveText(
    '📍 Đà Nẵng · Chợ Hàn · Đã chỉnh sửa',
  );
  expect((await e2eDb.video.findUniqueOrThrow({ where: { id: video.id } })).hashtags).toEqual(['moi']);
});
