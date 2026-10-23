import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { e2eDb } from './helpers/db';
import { signUpWithKiot } from './helpers/seller';

test('rút tiền: thấy số tiền nhận trước khi xác nhận; huỷ thì số dư quay về', async ({ page }) => {
  const { slug } = await signUpWithKiot(page, 'Kiot Rút');
  await page.goto('/kiot-cua-toi/so-du/rut');
  await expect(page.getByTestId('payout-blocker')).toContainText('xác minh danh tính');

  // Giả lập: CCCD đã duyệt, tài khoản nhận khai báo 2 ngày trước, có 120.000đ tiền bán hàng.
  const kiot = await e2eDb.kiot.findUniqueOrThrow({ where: { slug } });
  await e2eDb.kycSubmission.create({
    data: {
      userId: kiot.ownerId,
      fullName: 'CHU KIOT',
      idNumber: '079123456789',
      frontImage: 'x',
      backImage: 'y',
      status: 'approved',
    },
  });
  await e2eDb.kiotPayoutAccount.create({
    data: {
      kiotId: kiot.id,
      bankBin: '970422',
      accountNumber: '0979393916',
      accountName: 'CHU KIOT',
      createdById: kiot.ownerId,
      createdAt: new Date(Date.now() - 2 * 86_400_000),
    },
  });
  await e2eDb.balanceEntry.create({
    data: { kiotId: kiot.id, type: 'order_credit', amount: 120_000, refId: randomUUID() },
  });

  await page.reload();
  await expect(page.getByTestId('payout-destination')).toContainText('MB Bank · 0979393916 · CHU KIOT');
  const quote = page.getByTestId('payout-quote');
  await expect(quote).toHaveText('Bạn sẽ nhận 120.000đ (phí 0đ)');
  await page.fill('#payout-amount', '40000');
  await expect(quote).toHaveText('Nhập số tiền từ 50.000đ.');
  await page.fill('#payout-amount', '100.000');
  await expect(quote).toHaveText('Bạn sẽ nhận 100.000đ (phí 0đ)');
  await page.getByRole('button', { name: 'Xác nhận rút' }).click();

  await page.waitForURL((u) => u.pathname === '/kiot-cua-toi/so-du');
  await expect(page.getByRole('status')).toContainText('Đã gửi yêu cầu rút RT');
  await expect(page.getByTestId('balance-available')).toHaveText('20.000đ');
  await expect(page.getByTestId('payout-list')).toContainText('Chờ 9MUA duyệt');

  await page.goto('/kiot-cua-toi/so-du/rut');
  await expect(page.getByTestId('payout-blocker')).toContainText('chờ xử lý');

  await page.goto('/kiot-cua-toi/so-du');
  await page.getByTestId('cancel-payout').click();
  await expect(page.getByTestId('payout-list')).toContainText('Đã huỷ');
  await expect(page.getByTestId('balance-available')).toHaveText('120.000đ');
});
