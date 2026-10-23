import { expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { e2eDb } from './helpers/db';
import { signUpBuyer } from './helpers/orders';

test('creator: thông báo khi video xong, trang creator, báo cáo, xoá video', async ({ browser }) => {
  const stamp = String(Date.now()).slice(-6);
  const creator = await signUpBuyer(browser, `Creator ${stamp}`);
  await creator.goto('/video/dang');
  await creator.getByTestId('video-input').setInputFiles('tests/fixtures/videos/landscape.mp4');
  await creator.getByTestId('video-caption').fill(`Clip trang creator ${stamp}`);
  await creator.getByRole('button', { name: 'Đăng video' }).click();
  await creator.waitForURL((u) => u.pathname === '/video/cua-toi');
  await creator.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });

  // Chuông thông báo có 1 thông báo mới.
  await creator.goto('/');
  await expect(creator.getByTestId('notifications-link')).toHaveAccessibleName('Thông báo (1 chưa đọc)');
  await creator.getByTestId('notifications-link').click();
  await expect(creator.getByTestId('notifications')).toContainText('Video đã đăng xong');

  const video = await e2eDb.video.findFirstOrThrow({ where: { caption: `Clip trang creator ${stamp}` } });
  await creator.goto(`/creator/${video.authorId}`);
  await expect(creator.getByTestId('creator-stats')).toHaveText('1 video · 0 lượt thích');

  // Người khác báo cáo video.
  const viewer = await signUpBuyer(browser, 'Người xem');
  await viewer.goto(`/v/${video.id}`);
  await viewer.getByTestId('feed-item').first().getByTestId('feed-report').click();
  await viewer
    .getByRole('dialog', { name: 'Báo cáo video' })
    .getByRole('button', { name: 'Lừa đảo' })
    .click();
  await expect(viewer.getByTestId('feed-toast')).toHaveText('Đã gửi báo cáo. 9MUA sẽ xem xét.');
  expect(await e2eDb.videoReport.count({ where: { videoId: video.id } })).toBe(1);

  // Người đăng xoá video.
  await creator.goto('/video/cua-toi');
  await creator
    .getByTestId('my-video')
    .filter({ hasText: `Clip trang creator ${stamp}` })
    .getByTestId('delete-video')
    .click();
  await expect(
    creator.getByTestId('my-video').filter({ hasText: `Clip trang creator ${stamp}` }),
  ).toHaveCount(0);
  expect((await viewer.goto(`/v/${video.id}`))?.status()).toBe(404);
});
