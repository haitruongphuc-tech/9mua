import { expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

// Trả lời bình luận bằng video (SPEC-creator.md V5.8): chủ video bấm "Trả lời bằng video" dưới bình luận, thẻ bình luận
// hiện trên video mới; dưới bình luận gốc có "Đã trả lời bằng video".
test('trả lời bình luận bằng video', async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = String(Date.now()).slice(-6);
  const owner = await newBuyerPage(browser, `Chủ shop ${stamp}`);
  const ownerUser = await e2eDb.user.findFirstOrThrow({ where: { displayName: `Chủ shop ${stamp}` } });
  const video = await e2eDb.video.create({
    data: {
      authorId: ownerUser.id,
      status: 'ready',
      caption: `Hàng mới ${stamp}`,
      fileUrl: '/uploads/khong-co.mp4',
      readyAt: new Date(),
    },
  });
  const fan = await newBuyerPage(browser, `Khách hỏi ${stamp}`);
  await fan.goto(`/v/${video.id}`);
  await fan.getByTestId('feed-item').first().getByTestId('feed-comments').click();
  await fan.getByTestId('comment-input').fill(`Còn size M không ${stamp}?`);
  await fan.getByTestId('comment-input').press('Enter');
  await expect(fan.getByTestId('comment').filter({ hasText: `Còn size M không ${stamp}?` })).toBeVisible();

  await owner.goto(`/v/${video.id}`);
  await owner.getByTestId('feed-item').first().getByTestId('feed-comments').click();
  await owner.getByTestId('comment').filter({ hasText: `size M` }).getByTestId('comment-reply-video').click();
  await owner.waitForURL(/\/video\/dang\?tra-loi=/);
  await owner.getByTestId('video-input').setInputFiles('tests/fixtures/videos/clip.webm');
  await expect(owner.getByTestId('overlay-reply-card')).toContainText(`Còn size M không ${stamp}?`);
  await owner.getByTestId('video-caption').fill(`Trả lời size M ${stamp}`);
  await owner.getByRole('button', { name: 'Đăng video' }).click();
  await owner.waitForURL((u) => u.pathname === '/video/cua-toi');
  await owner.request.get('http://localhost:3100/api/internal/video/process', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  const reply = await e2eDb.video.findFirstOrThrow({ where: { caption: `Trả lời size M ${stamp}` } });
  expect(reply.status).toBe('ready');
  expect(reply.replyToCommentId).not.toBeNull();

  await fan.goto(`/v/${reply.id}`);
  await expect(fan.getByTestId('feed-item').first().getByTestId('feed-reply-card')).toContainText(`size M`);
  await fan.goto(`/v/${video.id}`);
  await fan.getByTestId('feed-item').first().getByTestId('feed-comments').click();
  await expect(fan.getByTestId('comment-video-reply')).toHaveAttribute('href', `/v/${reply.id}`);
});
