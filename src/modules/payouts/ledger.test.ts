import { describe, expect, it } from 'vitest';
import '@/server/payments';
import '@/server/orders';
import { db } from '@/lib/db';
import { createPaidOrder } from '../../../tests/helpers/factories';
import { creditCompletedOrder, getBalance, listBalanceEntries } from './ledger';

async function completedOrder(price = 100_000) {
  const ctx = await createPaidOrder({ price });
  const order = await db.order.update({
    where: { id: ctx.order.id },
    data: { status: 'completed', completedAt: new Date() },
  });
  return { ...ctx, order };
}

describe('sổ số dư', () => {
  it('đơn hoàn tất → số dư = tổng − phí sàn; ghi doanh thu sàn', async () => {
    const { seller, order } = await completedOrder(100_000);
    await db.$transaction((tx) => creditCompletedOrder(tx, order));
    expect(await getBalance(seller.kiotId)).toMatchObject({ available: 95_000 });
    expect(await db.platformRevenue.findUniqueOrThrow({ where: { orderId: order.id } })).toMatchObject({
      fee: 5_000,
    });
  });

  it('hook chạy 2 lần (kể cả song song) vẫn chỉ cộng 1 lần', async () => {
    const { seller, order } = await completedOrder();
    await Promise.all([
      db.$transaction((tx) => creditCompletedOrder(tx, order)),
      db.$transaction((tx) => creditCompletedOrder(tx, order)),
    ]);
    await db.$transaction((tx) => creditCompletedOrder(tx, order));
    expect(await db.balanceEntry.count({ where: { kiotId: seller.kiotId } })).toBe(1);
    expect((await getBalance(seller.kiotId)).available).toBe(95_000);
  });

  it('"đang chờ" = tổng đơn đã trả chưa hoàn tất', async () => {
    const { seller, order } = await createPaidOrder({ price: 80_000 });
    expect(await getBalance(seller.kiotId)).toEqual({ available: 0, pending: order.total });
  });

  it('sổ không sửa/xoá được', async () => {
    const { order } = await completedOrder();
    await db.$transaction((tx) => creditCompletedOrder(tx, order));
    await expect(db.balanceEntry.updateMany({ data: { amount: 1 } })).rejects.toThrow();
    await expect(db.balanceEntry.deleteMany()).rejects.toThrow();
  });

  it('lịch sử có mã đơn và phí sàn', async () => {
    const { seller, order } = await completedOrder(100_000);
    await db.$transaction((tx) => creditCompletedOrder(tx, order));
    const page = await listBalanceEntries(seller.kiotId);
    expect(page[0]).toMatchObject({
      type: 'order_credit',
      amount: 95_000,
      orderCode: order.code,
      fee: 5_000,
    });
  });

  it('tick hoàn tất đơn thì tự cộng số dư (hook đăng ký ở tầng ứng dụng)', async () => {
    const { runOrderTick } = await import('@/server/orders');
    const { seller, order } = await createPaidOrder({ price: 100_000 });
    await db.order.update({
      where: { id: order.id },
      data: { status: 'delivered', deliveredAt: new Date(Date.now() - 8 * 86_400_000) },
    });
    await runOrderTick();
    expect((await getBalance(seller.kiotId)).available).toBe(95_000);
  });
});
