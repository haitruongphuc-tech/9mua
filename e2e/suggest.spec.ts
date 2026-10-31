import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

// Bạn chung, gợi ý follow, tab Đã thích (SPEC-social.md V5.1–V5.2).
test('bạn chung trên trang cá nhân, gợi ý follow ở trang Tôi, tab Đã thích công khai', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const stamp = String(Date.now()).slice(-6);
  const me = await newBuyerPage(browser, `Tôi ${stamp}`);
  const meUser = await e2eDb.user.findFirstOrThrow({ where: { displayName: `Tôi ${stamp}` } });
  const mk = (name: string) => e2eDb.user.create({ data: { displayName: name, passwordHash: 'x' } });
  const friends = await Promise.all([`Bạn A ${stamp}`, `Bạn B ${stamp}`, `Bạn C ${stamp}`].map(mk));
  const star = await mk(`Ngôi sao ${stamp}`);
  for (const f of friends) {
    await e2eDb.follow.create({ data: { followerId: meUser.id, followeeId: f.id } });
    await e2eDb.follow.create({ data: { followerId: f.id, followeeId: star.id } });
  }
  await me.goto(`/creator/${star.id}`);
  await expect(me.getByTestId('mutual-followers')).toContainText('và 1 người bạn follow khác');
  await me.getByTestId('mutual-followers').click();
  await expect(me.getByTestId('follow-person')).toHaveCount(3);

  await me.goto('/tai-khoan');
  const card = me.getByTestId('suggest-card').filter({ hasText: `Ngôi sao ${stamp}` });
  await expect(card).toContainText('3 bạn chung');
  await card.getByTestId('suggest-follow').click();
  await expect(card.getByTestId('suggest-follow')).toHaveText('Đang follow');

  // Tab Đã thích: mặc định chỉ mình thấy; bật công khai thì người khác thấy.
  const v = await e2eDb.video.create({
    data: {
      authorId: star.id,
      status: 'ready',
      caption: `Video thích ${stamp}`,
      fileUrl: '/uploads/khong-co.mp4',
      readyAt: new Date(),
    },
  });
  await e2eDb.videoLike.create({ data: { videoId: v.id, userId: meUser.id, createdAt: new Date() } });
  const other = await newBuyerPage(browser, `Khách ${stamp}`);
  await other.goto(`/creator/${meUser.id}`);
  await expect(other.getByTestId('profile-liked')).toHaveCount(0);
  await me.goto('/tai-khoan/cai-dat#da-thich');
  await me.getByTestId('liked-public').check();
  await me.getByTestId('liked-save').click();
  await me.waitForURL(/da-luu=da-thich/);
  await other.reload();
  await expect(other.getByTestId('profile-liked')).toBeVisible();
});
