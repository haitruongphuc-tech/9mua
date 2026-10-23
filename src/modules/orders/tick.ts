import type { OrderStatus } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { notifyBuyer } from './notify';
import { expireUnpaidOrders } from './place-order';
import type { OrderAction } from './state-machine';
import { DISPUTE_WINDOW_DAYS } from './buyer';
import { applyAction } from './transition-core';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// Tác vụ định kỳ (cron 5 phút, SPEC-orders.md mục 11). Mỗi đơn xử lý trong transaction riêng có khoá dòng,
// nên chạy lại hoặc chạy chồng đều an toàn: đơn đã đổi trạng thái thì applyAction từ chối và bỏ qua.
async function sweep(
  status: OrderStatus,
  field: 'paidAt' | 'shippedAt' | 'deliveredAt',
  olderThanMs: number,
  action: OrderAction,
  reason: string,
) {
  const cutoff = new Date(now().getTime() - olderThanMs);
  const due = await db.order.findMany({
    where: { status, [field]: { lt: cutoff } },
    select: { id: true },
    take: 1000,
  });
  let done = 0;
  for (const { id } of due) {
    try {
      await db.$transaction((tx) => applyAction(tx, id, action, { id: null, role: 'system' }, { reason }));
      done += 1;
      await notifyBuyer(id, action).catch((e) => console.error('[orders] Gửi mail lỗi:', e));
    } catch {
      // Đơn vừa đổi trạng thái ở luồng khác.
    }
  }
  return done;
}

export async function runOrderTick() {
  const { expired } = await expireUnpaidOrders();
  const autoRefunded = await sweep(
    'paid',
    'paidAt',
    48 * HOUR,
    'auto_refund',
    'Người bán không xác nhận trong 48 giờ',
  );
  const autoDelivered = await sweep(
    'shipping',
    'shippedAt',
    10 * DAY,
    'auto_deliver',
    'Tự ghi nhận đã giao sau 10 ngày',
  );
  const completed = await sweep(
    'delivered',
    'deliveredAt',
    DISPUTE_WINDOW_DAYS * DAY,
    'complete',
    'Hết 7 ngày khiếu nại',
  );
  return { expired, autoRefunded, autoDelivered, completed };
}
