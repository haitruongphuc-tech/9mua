import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

// Thông báo mới (SPEC-social.md V5.5): tắt từng loại trong Cài đặt; có người follow thì nhận "… đã follow bạn".
test('cài đặt thông báo: tắt loại "thích", follow mới vẫn báo', async ({ browser }) => {
  const stamp = String(Date.now()).slice(-6);
  const me = await newBuyerPage(browser, `Nhận báo ${stamp}`);
  const meUser = await e2eDb.user.findFirstOrThrow({ where: { displayName: `Nhận báo ${stamp}` } });
  await me.goto('/tai-khoan/cai-dat#thong-bao');
  await me.getByTestId('notify-type-like').uncheck();
  await me.getByTestId('notify-save').click();
  await me.waitForURL(/da-luu=thong-bao/);
  expect((await e2eDb.user.findUniqueOrThrow({ where: { id: meUser.id } })).notifyOff).toEqual(['like']);
  await expect(me.getByTestId('notify-type-like')).not.toBeChecked();

  const fan = await newBuyerPage(browser, `Người follow ${stamp}`);
  await fan.goto(`/creator/${meUser.id}`);
  await fan.getByTestId('profile-follow').click();
  await expect(fan.getByTestId('stat-followers')).toHaveText('1');
  await me.goto('/thong-bao');
  await expect(me.getByText(`Người follow ${stamp} đã follow bạn`)).toBeVisible();
});
