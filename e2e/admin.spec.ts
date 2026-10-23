import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';
import { promoteToAdmin, setUpAdminTotp } from './helpers/admin';
import { e2eDb } from './helpers/db';
import { signUpWithKiot } from './helpers/seller';

test('CEO: "Cần xử lý" có yêu cầu rút → Chi qua PayOS (giả) → hàng chờ không còn → nhật ký có dòng', async ({
  page,
  browser,
}) => {
  // Người bán đủ điều kiện rút lần đầu (luôn vào hàng chờ duyệt tay).
  const { slug } = await signUpWithKiot(page, 'Kiot Rút Lần Đầu');
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
      createdAt: new Date(Date.now() - 4 * 86_400_000),
    },
  });
  await e2eDb.balanceEntry.create({
    data: { kiotId: kiot.id, type: 'order_credit', amount: 300_000, refId: randomUUID() },
  });
  await page.goto('/kiot-cua-toi/so-du/rut');
  await page.fill('#payout-amount', '200000');
  await page.getByRole('button', { name: 'Xác nhận rút' }).click();
  await page.waitForURL((u) => u.pathname === '/kiot-cua-toi/so-du');
  const payout = await e2eDb.payoutRequest.findFirstOrThrow({ where: { kiotId: kiot.id } });
  expect(payout).toMatchObject({ status: 'pending', mode: 'manual' });

  // CEO đăng nhập + 2 lớp.
  const ceo = await browser.newPage();
  const phone = `07${String(Date.now()).slice(-8)}`;
  await ceo.goto('/dang-ky?next=/');
  await ceo.fill('#identifier', phone);
  await ceo.fill('#displayName', 'CEO duyệt');
  await ceo.fill('#password', 'mat-khau-ceo-e2e-123');
  await ceo.click('button[type=submit]');
  await ceo.waitForURL((u) => u.pathname === '/');
  promoteToAdmin(phone);
  await setUpAdminTotp(ceo);
  await expect(ceo.getByTestId('todo-payouts')).toBeVisible();
  await ceo.getByTestId('todo-payouts').click();
  await ceo.waitForURL((u) => u.pathname === '/admin/rut-tien');

  const row = ceo.locator(`[data-testid=payout-row][data-code="${payout.code}"]`);
  await expect(row).toContainText('Lần rút đầu');
  ceo.on('dialog', (d) => void d.accept());
  await row.getByTestId('approve-payos').click();
  await expect(ceo.getByTestId('flash-ok')).toHaveText('Đã gửi lệnh chi qua PayOS.');
  await expect(row).toHaveCount(0);

  // PayOS giả trả SUCCEEDED ở lần đồng bộ kế tiếp.
  await ceo.request.get('http://localhost:3100/api/internal/payouts/sync', {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  expect(await e2eDb.payoutRequest.findUniqueOrThrow({ where: { id: payout.id } })).toMatchObject({
    status: 'paid',
    mode: 'manual',
  });
  const logs = await e2eDb.adminAuditLog.findMany({ where: { targetId: payout.id } });
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({
    action: 'payout.approve_payos',
    before: { status: 'pending' },
    after: { status: 'processing' },
  });
});

test('CEO: mọi trang hàng chờ mở được, không lỗi', async ({ browser }) => {
  const ceo = await browser.newPage();
  const phone = `07${String(Date.now()).slice(-8)}`;
  await ceo.goto('/dang-ky?next=/');
  await ceo.fill('#identifier', phone);
  await ceo.fill('#displayName', 'CEO xem');
  await ceo.fill('#password', 'mat-khau-ceo-e2e-123');
  await ceo.click('button[type=submit]');
  await ceo.waitForURL((u) => u.pathname === '/');
  promoteToAdmin(phone);
  await setUpAdminTotp(ceo);
  for (const [path, heading] of [
    ['/admin/rut-tien', 'Rút tiền chờ duyệt'],
    ['/admin/rut-tien?trang-thai=processing', 'Lệnh chi đang chuyển'],
    ['/admin/kyc', 'KYC chờ duyệt'],
    ['/admin/hoan-tien', 'Đơn chờ hoàn tiền'],
    ['/admin/khieu-nai', 'Khiếu nại'],
    ['/admin/lech-tien', 'Thanh toán lệch tiền'],
    ['/admin/bao-cao', 'Báo cáo vi phạm'],
  ] as const) {
    const res = await ceo.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(ceo.getByRole('heading', { level: 1 }), path).toHaveText(heading);
  }
});
