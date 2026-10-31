import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

// Nhóm (SPEC-social.md V5.10): tạo nhóm riêng tư, người ngoài không thấy bài, xin vào → quản trị duyệt → thấy bài.
test('nhóm riêng tư: xin vào, quản trị duyệt, thành viên thấy bài', async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = String(Date.now()).slice(-6);
  const owner = await newBuyerPage(browser, `Chủ nhóm ${stamp}`);
  // Tài khoản cần tạo từ 7 ngày mới được tạo nhóm.
  await e2eDb.user.updateMany({
    where: { displayName: `Chủ nhóm ${stamp}` },
    data: { createdAt: new Date(Date.now() - 10 * 86_400_000) },
  });
  await owner.goto('/nhom/tao');
  const form = owner.getByTestId('group-form');
  await form.locator('[name=name]').fill(`Hội kín ${stamp}`);
  await owner.getByTestId('group-private').check();
  await owner.getByTestId('group-submit').click();
  await expect(owner.getByTestId('group-name')).toHaveText(`Hội kín ${stamp}`);
  const url = owner.url();
  await owner.getByTestId('group-composer').locator('[name=text]').fill(`Bài kín ${stamp}`);
  await owner.getByTestId('group-post-submit').click();
  await expect(owner.getByTestId('group-feed')).toContainText(`Bài kín ${stamp}`);

  const fan = await newBuyerPage(browser, `Fan nhóm ${stamp}`);
  await fan.goto(url);
  await expect(fan.getByTestId('group-members-only')).toBeVisible();
  await expect(fan.getByText(`Bài kín ${stamp}`)).toHaveCount(0);
  await fan.getByTestId('group-join').click();
  await expect(fan.getByTestId('group-pending')).toBeVisible();

  await owner.getByTestId('group-admin-link').click();
  await owner.getByTestId('group-member-approve').click();
  await expect(owner.getByTestId('group-member-approve')).toHaveCount(0);

  await fan.goto(url);
  await expect(fan.getByTestId('group-feed')).toContainText(`Bài kín ${stamp}`);
  await expect(fan.getByTestId('group-meta')).toContainText('2');
});
