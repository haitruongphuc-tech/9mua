import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';
import { newBuyerPage } from './helpers/auth';

// Tài khoản riêng tư (SPEC-identity.md V5.2): bật trong Cài đặt; người lạ thấy trang bị khoá, gửi yêu cầu follow;
// chủ tài khoản chấp nhận thì người đó xem được.
test('tài khoản riêng tư: yêu cầu follow, chấp nhận, xem được trang', async ({ browser }) => {
  test.setTimeout(90_000);
  const stamp = String(Date.now()).slice(-6);
  const owner = await newBuyerPage(browser, `Riêng tư ${stamp}`);
  const ownerUser = await e2eDb.user.findFirstOrThrow({ where: { displayName: `Riêng tư ${stamp}` } });
  await owner.goto('/tai-khoan/cai-dat#rieng-tu');
  await owner.getByTestId('private-on').check();
  await owner.getByTestId('private-save').click();
  await owner.waitForURL(/da-luu=rieng-tu/);
  await expect(owner.getByTestId('private-on')).toBeChecked();

  const fan = await newBuyerPage(browser, `Xin follow ${stamp}`);
  await fan.goto(`/creator/${ownerUser.id}`);
  await expect(fan.getByTestId('profile-private')).toBeVisible();
  await fan.getByTestId('profile-follow').click();
  await expect(fan.getByTestId('profile-follow')).toHaveText('Đã gửi yêu cầu');

  await owner.goto('/tai-khoan/yeu-cau-follow');
  await expect(owner.getByTestId('follow-request')).toContainText(`Xin follow ${stamp}`);
  await owner.getByTestId('follow-request-accept').click();
  await expect(owner.getByTestId('follow-request')).toHaveCount(0);

  await fan.reload();
  await expect(fan.getByTestId('profile-private')).toHaveCount(0);
  await expect(fan.getByTestId('profile-follow')).toHaveText('Đang follow');
});
