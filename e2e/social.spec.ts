import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';
import { signUpBuyer } from './helpers/orders';

// SPEC-social.md: follow từ feed → tab Đang Follow; bình luận → người đăng nhận thông báo; lưu; chạm 2 lần thả tim;
// trang hashtag.
test('feed V4: follow, bình luận, lưu, chạm 2 lần thả tim, tab Đang Follow, hashtag', async ({ browser }) => {
  test.setTimeout(60_000);
  const stamp = String(Date.now()).slice(-7);
  const author = await signUpBuyer(browser, `Tác Giả ${stamp}`);
  const authorRow = await e2eDb.user.findFirstOrThrow({ where: { displayName: `Tác Giả ${stamp}` } });
  const video = await e2eDb.video.create({
    data: {
      authorId: authorRow.id,
      caption: `Hàng mới về #xahoi${stamp}`,
      hashtags: [`xahoi${stamp}`],
      status: 'ready',
      fileUrl: `/uploads/xa-hoi-${stamp}.mp4`,
      readyAt: new Date(),
      durationSec: 10,
    },
  });

  const fan = await signUpBuyer(browser, `Người Hâm Mộ ${stamp}`);
  await fan.goto(`/v/${video.id}`);
  const item = fan.getByTestId('feed-item').first();
  await expect(item).toContainText(`Hàng mới về`);

  await item.getByTestId('feed-follow').click();
  await expect(item.getByTestId('feed-follow')).toHaveAttribute('aria-pressed', 'true');

  await item.getByTestId('feed-save').click();
  await expect(item.getByTestId('feed-save')).toHaveAttribute('aria-pressed', 'true');

  // Chạm 2 lần lên video: túi cam bay lên và thả tim (không bỏ tim khi chạm 2 lần nữa).
  await item.locator('video').dblclick({ position: { x: 150, y: 250 } });
  await expect(fan.getByTestId('heart-pop').first()).toBeVisible();
  await expect(item.getByTestId('feed-likes')).toHaveText('1');
  await item.locator('video').dblclick({ position: { x: 150, y: 250 } });
  await expect(item.getByTestId('feed-likes')).toHaveText('1');

  await item.getByTestId('feed-comments').click();
  const sheet = fan.getByTestId('comments-sheet');
  await sheet.getByRole('textbox').fill('Có link shopee.vn/abc nè');
  await sheet.getByRole('button', { name: 'Gửi' }).click();
  await expect(sheet.getByTestId('comment-error')).toHaveText('Bình luận không được chứa link.');
  await sheet.getByRole('textbox').fill('Đẹp quá shop ơi');
  await sheet.getByRole('button', { name: 'Gửi' }).click();
  await expect(sheet.getByTestId('comment')).toHaveText(/Đẹp quá shop ơi/);
  await expect(sheet.getByRole('heading')).toHaveText('1 bình luận');
  await sheet.getByRole('button', { name: 'Đóng' }).click();
  await expect(item.getByTestId('feed-comment-count')).toHaveText('1');

  // Tab Đang Follow trên trang chủ chỉ có video của người đã follow.
  await fan.goto('/');
  await fan.getByRole('tab', { name: 'Đang Follow' }).click();
  await expect(fan.getByTestId('feed-item').first()).toContainText('Hàng mới về');

  // Người đăng nhận thông báo bình luận (dịch theo khoá).
  await author.goto('/thong-bao');
  await expect(author.getByTestId('notifications')).toContainText(
    `Người Hâm Mộ ${stamp} bình luận: Đẹp quá shop ơi`,
  );

  // Trang hashtag.
  await fan.goto(`/hashtag/xahoi${stamp}`);
  await expect(fan.getByRole('heading', { level: 1 })).toHaveText(`#xahoi${stamp}`);
  await expect(fan.getByTestId('video-grid').locator('li')).toHaveCount(1);

  expect(await e2eDb.savedVideo.count({ where: { videoId: video.id } })).toBe(1);
  expect(await e2eDb.follow.count({ where: { followeeId: authorRow.id } })).toBe(1);
});
