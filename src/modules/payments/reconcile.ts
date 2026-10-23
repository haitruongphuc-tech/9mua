import type { PaymentIntent } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { applyTransaction } from './apply';
import { gateway } from './gateway';

// Hỏi lại PayOS một intent: ghi nhận giao dịch chưa có (đi qua đúng hàm của webhook) và cập nhật hạn.
export async function reconcileIntent(intent: PaymentIntent): Promise<void> {
  const orderCode = Number(intent.orderCode);
  const status = await gateway().getStatus(orderCode);
  for (const t of status.transactions) await applyTransaction(orderCode, t, 'reconcile', t);

  const current = now();
  const nextStatus =
    status.status === 'CANCELLED'
      ? 'cancelled'
      : status.status === 'EXPIRED' || intent.expiresAt <= current
        ? 'expired'
        : null;
  await db.paymentIntent.updateMany({
    where: { id: intent.id },
    data: { lastCheckedAt: current },
  });
  if (nextStatus)
    await db.paymentIntent.updateMany({
      where: { id: intent.id, status: 'pending' },
      data: { status: nextStatus },
    });
}

// Cron mỗi 5 phút: phòng webhook bị mất. Kiểm intent đang chờ và intent hết hạn trong 24 giờ qua.
export async function reconcilePending(): Promise<{ checked: number; failed: number }> {
  const since = new Date(now().getTime() - 24 * 3_600_000);
  const intents = await db.paymentIntent.findMany({
    where: { status: { in: ['pending', 'expired'] }, createdAt: { gt: since } },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });
  let failed = 0;
  for (const intent of intents) {
    try {
      await reconcileIntent(intent);
    } catch (error) {
      failed += 1;
      console.error(`[payos] Đối soát lỗi orderCode=${intent.orderCode}:`, error);
    }
  }
  return { checked: intents.length, failed };
}
