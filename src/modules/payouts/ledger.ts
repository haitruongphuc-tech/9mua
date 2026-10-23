import { randomUUID } from 'node:crypto';
import { now } from '@/lib/clock';
import { db, type Tx } from '@/lib/db';
import type { CompletedOrder } from '@/modules/orders';
import { sellerCredit } from './fees';

// Hook "đơn hoàn tất" (SPEC-payouts.md mục 1): chạy trong transaction của orders.
// Khoá duy nhất (type, refId) + ON CONFLICT DO NOTHING nên chạy lại bao nhiêu lần cũng chỉ cộng 1 lần.
export async function creditCompletedOrder(tx: Tx, order: CompletedOrder): Promise<void> {
  const { fee, credit } = sellerCredit(order);
  const at = now();
  await tx.$executeRaw`
    INSERT INTO "BalanceEntry" (id, "kiotId", type, amount, "refId", note, "createdAt")
    VALUES (${randomUUID()}, ${order.kiotId}, 'order_credit', ${credit}, ${order.id}, ${`Đơn ${order.code}`}, ${at})
    ON CONFLICT (type, "refId") DO NOTHING`;
  await tx.$executeRaw`
    INSERT INTO "PlatformRevenue" ("orderId", "kiotId", fee, "createdAt")
    VALUES (${order.id}, ${order.kiotId}, ${fee}, ${at})
    ON CONFLICT ("orderId") DO NOTHING`;
}

const PENDING_STATUSES = ['paid', 'confirmed', 'shipping', 'delivered', 'disputed'] as const;

export async function availableBalance(kiotId: string, tx: Tx | typeof db = db): Promise<number> {
  const r = await tx.balanceEntry.aggregate({ where: { kiotId }, _sum: { amount: true } });
  return r._sum.amount ?? 0;
}

export async function getBalance(kiotId: string): Promise<{ available: number; pending: number }> {
  const [available, pending] = await Promise.all([
    availableBalance(kiotId),
    db.order.aggregate({ where: { kiotId, status: { in: [...PENDING_STATUSES] } }, _sum: { total: true } }),
  ]);
  return { available, pending: pending._sum.total ?? 0 };
}

export type BalanceEntryView = {
  id: string;
  type: string;
  amount: number;
  note: string | null;
  createdAt: Date;
  orderCode: string | null;
  fee: number | null;
};

export async function listBalanceEntries(kiotId: string, take = 100): Promise<BalanceEntryView[]> {
  const entries = await db.balanceEntry.findMany({ where: { kiotId }, orderBy: { createdAt: 'desc' }, take });
  const orderIds = entries.filter((e) => e.type === 'order_credit').map((e) => e.refId);
  const [orders, fees] = await Promise.all([
    db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, code: true } }),
    db.platformRevenue.findMany({ where: { orderId: { in: orderIds } } }),
  ]);
  const code = new Map(orders.map((o) => [o.id, o.code]));
  const fee = new Map(fees.map((f) => [f.orderId, f.fee]));
  return entries.map((e) => ({
    id: e.id,
    type: e.type,
    amount: e.amount,
    note: e.note,
    createdAt: e.createdAt,
    orderCode: code.get(e.refId) ?? null,
    fee: fee.get(e.refId) ?? null,
  }));
}
