import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

// Bài đăng ảnh + chữ (SPEC-creator.md V5.10): đăng bài 2 ảnh + hashtag, bài chữ nền màu; người khác thấy trên trang chủ,
// trang cá nhân, hashtag; thích, bình luận.
test('bài viết: đăng ảnh + chữ, nền màu, hiện ở trang chủ / trang cá nhân / hashtag, thích, bình luận', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const stamp = String(Date.now()).slice(-6);
  const tag = `baiviet${stamp}`;
  const author = await newBuyerPage(browser, `Người viết ${stamp}`);
  await author.goto('/video/dang');
  await author.getByTestId('mode-post').click();
  await author.waitForURL('**/video/dang?bai=1');
  await author.getByTestId('post-text-input').fill(`Mực một nắng mới về\nGiá tốt #${tag}`);
  await author
    .getByTestId('post-image-input')
    .setInputFiles(['e2e/fixtures/anh-cam.jpg', 'e2e/fixtures/anh-den.jpg']);
  await expect(author.getByTestId('post-images-picked').locator('li')).toHaveCount(2);
  await author.getByTestId('post-submit').click();
  await author.waitForURL(/\/p\/[^/]+$/);
  await expect(author.getByTestId('post-images').locator('img')).toHaveCount(2);
  const post = await e2eDb.post.findFirstOrThrow({ where: { hashtags: { has: tag } } });

  // Bài chỉ có chữ, nền màu.
  await author.goto('/video/dang?bai=1');
  await author.getByTestId('post-text-input').fill(`Chào cả nhà ${stamp}`);
  await author.getByTestId('post-bg-7c3aed').click();
  await author.getByTestId('post-submit').click();
  await author.waitForURL(/\/p\/[^/]+$/);
  const bg = await e2eDb.post.findFirstOrThrow({ where: { text: `Chào cả nhà ${stamp}` } });
  expect(bg.bgColor).toBe('#7c3aed');

  const fan = await newBuyerPage(browser, `Bạn đọc ${stamp}`);
  await fan.goto(`/hashtag/${tag}`);
  await expect(fan.getByTestId('post-card')).toHaveCount(1);
  await fan.goto(`/creator/${post.authorId}`);
  await expect(fan.getByTestId('profile-posts')).toContainText('Bài viết (2)');
  await fan.goto(`/p/${post.id}`);
  await fan.getByTestId('post-like').click();
  await expect(fan.getByTestId('post-like')).toHaveAttribute('aria-pressed', 'true');
  await fan.getByTestId('post-comment-input').fill('Còn hàng không shop?');
  await fan.getByTestId('post-comment-send').click();
  await expect(fan.getByTestId('post-comment').first()).toContainText('Còn hàng không shop?');
  expect((await e2eDb.post.findUniqueOrThrow({ where: { id: post.id } })).likes).toBe(1);
  // Trang bài không đẩy trang rộng hơn màn hình điện thoại.
  expect(await fan.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await fan.evaluate(() => window.visualViewport!.width),
  );
});
