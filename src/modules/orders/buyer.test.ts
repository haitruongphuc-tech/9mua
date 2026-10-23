import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import '@/server/payments';
import { advanceClock, setClock } from '@/lib/clock';
import { db } from '@/lib/db';
import { createPaidOrder, createUser, sampleImage } from '../../../tests/helpers/factories';
import {
  listOrdersForBuyer,
  getOrderForBuyer,
  setRefundAccount,
  submitDispute,
  uploadDisputeImage,
} from './buyer';
import { clearCompletionHooks, onOrderCompleted } from './hooks';
import { runOrderTick } from './tick';
import { transition } from './transition';

beforeAll(async () => {
  process.env.UPLOAD_DIR = await mkdtemp(path.join(tmpdir(), '9mua-disputes-'));
});

async function shipped() {
  const ctx = await createPaidOrder();
  await transition(ctx.order.id, 'confirm', { userId: ctx.seller.user.id, role: 'seller' });
  await transition(
    ctx.order.id,
    'ship',
    { userId: ctx.seller.user.id, role: 'seller' },
    { trackingCode: 'X1' },
  );
  return ctx;
}

describe('người mua', () => {
  it('xem đơn của mình, không xem được đơn người khác', async () => {
    const { buyer, order } = await createPaidOrder();
    const stranger = await createUser();
    expect((await listOrdersForBuyer(buyer.id)).map((o) => o.id)).toEqual([order.id]);
    expect(await getOrderForBuyer(stranger.id, order.id)).toBeNull();
  });

  it('bấm Đã nhận hàng khi đang giao', async () => {
    const { buyer, order } = await shipped();
    expect(await transition(order.id, 'receive', { userId: buyer.id, role: 'buyer' })).toEqual({ ok: true });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('delivered');
  });

  it('khiếu nại trong 7 ngày sau khi nhận, kèm tối đa 3 ảnh của chính mình', async () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    const { buyer, order } = await shipped();
    await transition(order.id, 'receive', { userId: buyer.id, role: 'buyer' });
    const img = await uploadDisputeImage(buyer.id, await sampleImage());
    if (!img.ok) throw new Error();
    expect(img.url).toMatch(new RegExp(`^/uploads/disputes/${buyer.id}/.+\\.webp$`));

    const other = await createUser();
    const foreign = await uploadDisputeImage(other.id, await sampleImage());
    if (!foreign.ok) throw new Error();
    expect(
      await submitDispute(buyer.id, order.id, { message: 'Hàng bị dập nát', images: [foreign.url] }),
    ).toEqual({ ok: false, error: 'INVALID_IMAGES' });
    expect(
      await submitDispute(buyer.id, order.id, {
        message: 'Hàng bị dập nát',
        images: [img.url, img.url, img.url, img.url],
      }),
    ).toEqual({ ok: false, error: 'INVALID_IMAGES' });

    expect(
      await submitDispute(buyer.id, order.id, { message: 'Hàng bị dập nát', images: [img.url] }),
    ).toEqual({ ok: true });
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { dispute: true } });
    expect(saved.status).toBe('disputed');
    expect(saved.dispute).toMatchObject({ message: 'Hàng bị dập nát', images: [img.url] });
  });

  it('quá 7 ngày sau khi nhận thì không khiếu nại được', async () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    const { buyer, order } = await shipped();
    await transition(order.id, 'receive', { userId: buyer.id, role: 'buyer' });
    advanceClock({ days: 7, minutes: 1 });
    expect(await submitDispute(buyer.id, order.id, { message: 'Hàng bị dập nát', images: [] })).toEqual({
      ok: false,
      error: 'DISPUTE_WINDOW_CLOSED',
    });
  });

  it('nhập tài khoản nhận hoàn tiền khi đơn chờ hoàn', async () => {
    const { seller, buyer, order } = await createPaidOrder();
    expect(
      await setRefundAccount(buyer.id, order.id, {
        bankBin: '970436',
        accountNumber: '1234567890',
        accountName: 'Trần Thị Mua',
      }),
    ).toEqual({ ok: false, error: 'NOT_REFUNDABLE' });
    await transition(order.id, 'reject', { userId: seller.user.id, role: 'seller' }, { reason: 'Hết hàng' });
    expect(
      await setRefundAccount(buyer.id, order.id, {
        bankBin: '970436',
        accountNumber: '1234567890',
        accountName: 'Trần Thị Mua',
      }),
    ).toEqual({ ok: true });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).refundAccount).toEqual({
      bankBin: '970436',
      accountNumber: '1234567890',
      accountName: 'TRAN THI MUA',
    });
  });
});

describe('tác vụ định kỳ', () => {
  it('48 giờ không xác nhận → refund_pending', async () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    const { order } = await createPaidOrder();
    advanceClock({ hours: 47 });
    await runOrderTick();
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('paid');
    advanceClock({ hours: 2 });
    expect((await runOrderTick()).autoRefunded).toBe(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('refund_pending');
  });

  it('10 ngày đang giao → delivered; 7 ngày sau → completed và hook chạy đúng 1 lần dù 2 tick song song', async () => {
    const hook = vi.fn(async () => {});
    clearCompletionHooks();
    onOrderCompleted(hook);
    setClock(new Date('2026-10-23T00:00:00Z'));
    const { order } = await shipped();
    advanceClock({ days: 10, minutes: 1 });
    expect((await runOrderTick()).autoDelivered).toBe(1);
    advanceClock({ days: 7, minutes: 1 });
    await Promise.all([runOrderTick(), runOrderTick()]);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('completed');
    expect(hook).toHaveBeenCalledTimes(1);
    clearCompletionHooks();
  });

  it('đơn đang khiếu nại không tự hoàn tất', async () => {
    setClock(new Date('2026-10-23T00:00:00Z'));
    const { buyer, order } = await shipped();
    await transition(order.id, 'receive', { userId: buyer.id, role: 'buyer' });
    await submitDispute(buyer.id, order.id, { message: 'Thiếu hàng so với đơn', images: [] });
    advanceClock({ days: 30 });
    await runOrderTick();
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('disputed');
  });
});
