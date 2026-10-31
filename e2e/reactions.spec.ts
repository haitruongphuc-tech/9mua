import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

// Cảm xúc + đăng lại (SPEC-social.md V5.8–V5.9): giữ nút tim chọn "Haha", bấm số xem từng loại; đăng lại từ bảng chia sẻ.
test('giữ tim chọn cảm xúc, xem từng loại, đăng lại video', async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = String(Date.now()).slice(-6);
  const owner = await newBuyerPage(browser, `Chủ cảm xúc ${stamp}`);
  const ownerUser = await e2eDb.user.findFirstOrThrow({ where: { displayName: `Chủ cảm xúc ${stamp}` } });
  await owner.close();
  const video = await e2eDb.video.create({
    data: {
      authorId: ownerUser.id,
      status: 'ready',
      caption: `Cảm xúc ${stamp}`,
      fileUrl: '/uploads/khong-co.mp4',
      readyAt: new Date(),
    },
  });
  const fan = await newBuyerPage(browser, `Fan cảm xúc ${stamp}`);
  await fan.goto(`/v/${video.id}`);
  const item = fan.getByTestId('feed-item').first();
  const like = item.getByTestId('feed-like');
  await like.dispatchEvent('pointerdown');
  await fan.waitForTimeout(600);
  await like.dispatchEvent('pointerup');
  await fan.getByTestId('reaction-haha').click();
  await expect(like).toContainText('😆');
  await expect(item.getByTestId('feed-likes')).toHaveText('1');
  await item.getByTestId('feed-like-count').click();
  await expect(fan.getByTestId('reaction-summary')).toContainText('Haha');
  expect((await e2eDb.videoLike.findFirstOrThrow({ where: { videoId: video.id } })).reaction).toBe('haha');

  await item.getByTestId('feed-share').click();
  await fan.getByTestId('share-sheet').getByTestId('share-repost').click();
  await expect(fan.getByTestId('feed-toast')).toContainText('Đã đăng lại');
  expect(await e2eDb.repost.count({ where: { videoId: video.id } })).toBe(1);
});
