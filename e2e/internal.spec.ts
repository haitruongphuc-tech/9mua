import { expect, test } from '@playwright/test';
import { E2E_CRON_TOKEN } from '../playwright.config';

// Gọi thẳng cổng app như cron trên VPS (không qua tên miền).
const APP = 'http://localhost:3100';

test('route nội bộ: thiếu/sai token → 404; đúng token → chạy đối soát', async ({ request }) => {
  expect((await request.get(`${APP}/api/internal/payments/reconcile`)).status()).toBe(404);
  expect(
    (
      await request.get(`${APP}/api/internal/payments/reconcile`, { headers: { 'x-internal-token': 'sai' } })
    ).status(),
  ).toBe(404);
  const ok = await request.get(`${APP}/api/internal/payments/reconcile`, {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toMatchObject({ checked: expect.any(Number), failed: 0 });
});

test('webhook PayOS từ chối chữ ký giả', async ({ request }) => {
  const res = await request.post(`${APP}/api/payos/webhook`, {
    data: { code: '00', data: { orderCode: 1, amount: 1 }, signature: 'gia-mao' },
  });
  expect(res.status()).toBe(400);
});

test('mọi route cron đều cần token; đúng token thì chạy', async ({ request }) => {
  for (const path of [
    'payouts/sync',
    'alerts/flush',
    'orders/tick',
    'billing/reminders',
    'marketplace/stats',
    'admin/digest',
    'video/process',
  ]) {
    expect((await request.get(`${APP}/api/internal/${path}`)).status(), path).toBe(404);
  }
  const sync = await request.get(`${APP}/api/internal/payouts/sync`, {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  expect(sync.status()).toBe(200);
  expect(await sync.json()).toMatchObject({ checked: expect.any(Number) });
  const flush = await request.get(`${APP}/api/internal/alerts/flush`, {
    headers: { 'x-internal-token': E2E_CRON_TOKEN },
  });
  expect(await flush.json()).toMatchObject({ sent: expect.any(Number) });
});
