import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { signUpWithPassword } from './helpers/auth';
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
  await signUpWithPassword(ceo, {
    identifier: phone,
    name: 'CEO duyệt',
    password: 'mat-khau-ceo-e2e-123',
    next: '/',
  });
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
  await signUpWithPassword(ceo, {
    identifier: phone,
    name: 'CEO xem',
    password: 'mat-khau-ceo-e2e-123',
    next: '/',
  });
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
    ['/admin/live', 'Live'],
    ['/admin/xu', 'Xu thưởng live'],
    ['/admin/ai', 'AI Studio'],
    ['/admin/voucher', 'Voucher mở Kiot'],
  ] as const) {
    const res = await ceo.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(ceo.getByRole('heading', { level: 1 }), path).toHaveText(heading);
  }
  await ceo.goto('/admin/live');
  await expect(ceo.getByTestId('live-connect-stats')).toContainText('lượt xem không kết nối được hình');
});

test('CEO: tra cứu và khoá Kiot, cài đặt có kiểm hợp lệ, công tắc chi tự động, tải CSV', async ({
  browser,
  page,
}) => {
  const { slug } = await signUpWithKiot(page, 'Kiot Bị Khoá');
  await e2eDb.kiot.update({ where: { slug }, data: { activeUntil: new Date(Date.now() + 86_400_000 * 30) } });

  const ceo = await browser.newPage();
  const phone = `07${String(Date.now()).slice(-8)}`;
  await signUpWithPassword(ceo, {
    identifier: phone,
    name: 'CEO tra cứu',
    password: 'mat-khau-ceo-e2e-123',
    next: '/',
  });
  promoteToAdmin(phone);
  await setUpAdminTotp(ceo);
  ceo.on('dialog', (d) => void d.accept());

  await ceo.goto(`/admin/tra-cuu?loai=kiot&q=${slug}`);
  const row = ceo.getByTestId('kiot-row');
  await row.getByPlaceholder('Lý do khoá Kiot').fill('Bán hàng cấm');
  await row.getByRole('button', { name: 'Khoá' }).click();
  await expect(ceo.getByTestId('flash-ok')).toHaveText('Đã khoá Kiot.');
  expect((await ceo.goto(`http://${slug}.9mua.test:3100/`))?.status()).toBe(404);
  const locked = await e2eDb.kiot.findUniqueOrThrow({ where: { slug } });
  expect(await e2eDb.adminAuditLog.count({ where: { action: 'kiot.lock', targetId: locked.id } })).toBe(1);

  await ceo.goto('/admin/cai-dat');
  await ceo.getByTestId('platform-fee').fill('31');
  await ceo.getByRole('button', { name: 'Lưu cài đặt' }).click();
  await expect(ceo.getByTestId('flash-error')).toContainText('Phí sàn phải từ 0 đến 3.000');

  const wasOn = (await ceo.getByTestId('auto-switch').textContent())!.includes('ĐANG BẬT');
  await ceo.getByTestId('toggle-auto').click();
  await expect(ceo.getByTestId('auto-switch')).toContainText(wasOn ? 'ĐANG TẮT' : 'ĐANG BẬT');
  await ceo.getByTestId('toggle-auto').click(); // trả lại như cũ cho các test khác
  await expect(ceo.getByTestId('auto-switch')).toContainText(wasOn ? 'ĐANG BẬT' : 'ĐANG TẮT');

  await ceo.goto('/admin/giao-dich');
  const csv = await ceo.evaluate(async () => {
    const res = await fetch(document.querySelector<HTMLAnchorElement>('[data-testid=export-in]')!.href);
    return {
      type: res.headers.get('content-type'),
      first: new Uint8Array(await res.arrayBuffer()).slice(0, 3).join(','),
    };
  });
  expect(csv).toEqual({ type: 'text/csv; charset=utf-8', first: '239,187,191' }); // BOM UTF-8
});
