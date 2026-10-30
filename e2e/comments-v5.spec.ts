import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

// Bình luận (SPEC-social.md V5.4): gợi ý @tên, @tên thành link, thả tim; từ cấm của chủ video làm bình luận tự ẩn, chủ
// video thấy mục "Đã ẩn" và hiện lại được.
test('bình luận: nhắc tên @, tim, từ cấm tự ẩn và hiện lại', async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = String(Date.now()).slice(-6);
  const owner = await newBuyerPage(browser, `Chủ video ${stamp}`);
  const ownerUser = await e2eDb.user.findFirstOrThrow({ where: { displayName: `Chủ video ${stamp}` } });
  await owner.goto('/tai-khoan/cai-dat#tu-cam');
  await owner.getByTestId('muted-input').fill('lừa đảo');
  await owner.getByTestId('muted-add').click();
  await expect(owner.getByTestId('muted-words')).toContainText('lừa đảo');
  const video = await e2eDb.video.create({
    data: {
      authorId: ownerUser.id,
      status: 'ready',
      caption: `Video bình luận ${stamp}`,
      fileUrl: '/uploads/khong-co.mp4',
      readyAt: new Date(),
    },
  });

  const friend = await newBuyerPage(browser, `Bạn thân ${stamp}`);
  const handle = `banthan${stamp}`;
  await e2eDb.user.updateMany({ where: { displayName: `Bạn thân ${stamp}` }, data: { handle } });
  await friend.close();

  const fan = await newBuyerPage(browser, `Fan ${stamp}`);
  await fan.goto(`/v/${video.id}`);
  await fan.getByTestId('feed-item').first().getByTestId('feed-comments').click();
  const input = fan.getByTestId('comment-input');
  await input.fill(`@banthan${stamp.slice(0, 3)}`);
  await fan
    .getByTestId('mention-suggestions')
    .getByRole('button', { name: new RegExp(handle) })
    .click();
  await expect(input).toHaveValue(`@${handle} `);
  await input.pressSequentially('xem video này');
  await input.press('Enter');
  const first = fan.getByTestId('comment').filter({ hasText: 'xem video này' });
  await expect(first.getByTestId('mention-link')).toHaveAttribute('href', `/@${handle}`);
  await first.getByTestId('comment-like').click();
  await expect(first.getByTestId('comment-like')).toHaveAttribute('aria-pressed', 'true');

  // Bình luận có từ cấm của chủ video: người viết vẫn thấy, kèm ghi chú đang ẩn với người khác.
  await fan.waitForTimeout(10_500); // bình luận cách nhau 10 giây
  await input.fill('Shop LỪA ĐẢO à');
  await input.press('Enter');
  await expect(fan.getByTestId('comment').filter({ hasText: 'Shop LỪA ĐẢO à' })).toBeVisible();

  await owner.goto(`/v/${video.id}`);
  await owner.getByTestId('feed-item').first().getByTestId('feed-comments').click();
  await expect(owner.getByTestId('comment').filter({ hasText: 'Shop LỪA ĐẢO à' })).toHaveCount(0);
  await owner
    .getByTestId('comments-muted')
    .getByRole('button', { name: /Đã ẩn 1 bình luận/ })
    .click();
  await owner.getByTestId('comment-unhide').click();
  await expect(
    owner.getByTestId('comments-sheet').getByTestId('comment').filter({ hasText: 'Shop LỪA ĐẢO à' }),
  ).toHaveCount(1);
  await expect(owner.getByTestId('comments-muted')).toHaveCount(0);
});
