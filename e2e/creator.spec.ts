import { expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { e2eDb } from './helpers/db';
import { signUpBuyer } from './helpers/orders';

test('creator: thông báo khi video xong, trang creator, báo cáo, xoá video', async ({ browser }) => {
  // Tải video lên rồi chờ worker ffmpeg: khi máy test đang chuyển mã video của test trước, có lúc gần 30 giây.
  test.setTimeout(60_000);
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

  // Thanh dưới hiện số thông báo trên nút Tôi; trang Tôi có lối vào Thông báo.
  await creator.goto('/');
  await expect(creator.getByTestId('nav-notifications')).toHaveText('1');
  await creator.goto('/tai-khoan');
  await expect(creator.getByTestId('notifications-link')).toHaveAccessibleName('Thông báo (1 chưa đọc)');
  await creator.getByTestId('notifications-link').click();
  await expect(creator.getByTestId('notifications')).toContainText('Video đã đăng xong');

  const video = await e2eDb.video.findFirstOrThrow({ where: { caption: `Clip trang creator ${stamp}` } });

  // Thống kê 7/30 ngày đầu trang Video của tôi (SPEC-social.md bổ sung 30/10, A4): số thật, mặc định 7 ngày.
  await e2eDb.videoView.create({
    data: {
      videoId: video.id,
      viewerKey: `a:${stamp}`,
      day: new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10),
    },
  });
  await creator.goto('/video/cua-toi');
  const stats = creator.getByTestId('creator-stats');
  await expect(stats.getByRole('link', { name: '7 ngày' })).toHaveAttribute('aria-current', 'page');
  await expect(stats.getByTestId('stat-views')).toHaveText('1');
  await expect(stats.getByTestId('stat-orders')).toHaveText('0');
  await expect(stats.getByTestId('stat-revenue')).toHaveText('0đ');
  await stats.getByRole('link', { name: '30 ngày' }).click();
  await creator.waitForURL((u) => u.searchParams.get('ngay') === '30');
  await expect(creator.getByTestId('creator-stats').getByRole('link', { name: '30 ngày' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(creator.getByTestId('my-video').first()).toContainText('0 bình luận · 0 lượt lưu');

  await creator.goto(`/creator/${video.authorId}`);
  await expect(creator.getByTestId('stat-videos')).toHaveText('1');
  await expect(creator.getByTestId('stat-likes')).toHaveText('0');

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
