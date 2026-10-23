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

// Mọi thao tác trừ số dư của một Kiot đi qua khoá này, nên không có hai lần trừ chạy chồng.
export async function lockKiotBalance(tx: Tx, kiotId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`balance:${kiotId}`}))`;
}

export type AdjustResult =
  | { ok: true }
  | { ok: false; error: 'NOT_FOUND' | 'REASON_REQUIRED' | 'INVALID_AMOUNT' | 'WOULD_GO_NEGATIVE' };

// CEO cộng/trừ số dư kèm lý do bắt buộc (SPEC-payouts.md mục 7). Không cho trừ quá số dư hiện có.
export async function adjustBalance(
  kiotId: string,
  adminId: string,
  amount: number,
  reason: string,
): Promise<AdjustResult> {
  const note = reason.trim();
  if (!note) return { ok: false, error: 'REASON_REQUIRED' };
  if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000_000)
    return { ok: false, error: 'INVALID_AMOUNT' };
  if (!(await db.kiot.count({ where: { id: kiotId } }))) return { ok: false, error: 'NOT_FOUND' };
  return db.$transaction(async (tx): Promise<AdjustResult> => {
    await lockKiotBalance(tx, kiotId);
    if (amount < 0 && (await availableBalance(kiotId, tx)) + amount < 0)
      return { ok: false, error: 'WOULD_GO_NEGATIVE' };
    await tx.balanceEntry.create({
      data: {
        kiotId,
        type: 'adjustment',
        amount,
        refId: randomUUID(),
        note: note.slice(0, 300),
        actorId: adminId,
        createdAt: now(),
      },
    });
    return { ok: true };
  });
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
