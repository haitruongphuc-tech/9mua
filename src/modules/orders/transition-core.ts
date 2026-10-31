import type { Order, OrderStatus, Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import type { Tx } from '@/lib/db';
import { restoreStock } from '@/modules/kiot';
import {
  nextStatus,
  RESTORES_STOCK,
  TIMESTAMP_FIELD,
  type ActorRole,
  type OrderAction,
} from './state-machine';
import { runCompletionHooks } from './hooks';

export type Actor = { id: string | null; role: ActorRole };

export class InvalidTransition extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly action: OrderAction,
  ) {
    super(`Không thể "${action}" đơn đang ở trạng thái ${from}`);
  }
}

// Mọi thay đổi trạng thái đơn đi qua đây, trong transaction của người gọi: khoá đơn, kiểm bảng chuyển
// trạng thái, ghi mốc thời gian + OrderEvent, hoàn kho nếu cần, chạy hook hoàn tất (payouts cộng số dư).
export async function applyAction(
  tx: Tx,
  orderId: string,
  action: OrderAction,
  actor: Actor,
  options: { reason?: string; data?: Prisma.OrderUpdateInput } = {},
): Promise<Order> {
  const [locked] = await tx.$queryRaw<
    { status: OrderStatus }[]
  >`SELECT status::text AS status FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
  if (!locked) throw new Error(`Không tìm thấy đơn ${orderId}`);
  const to = nextStatus(locked.status, action, actor.role);
  if (!to) throw new InvalidTransition(locked.status, action);

  const at = now();
  const stamp = TIMESTAMP_FIELD[to];
  const order = await tx.order.update({
    where: { id: orderId },
    data: { ...options.data, status: to, ...(stamp ? { [stamp]: at } : {}) },
  });
  await tx.orderEvent.create({
    data: {
      orderId,
      from: locked.status,
      to,
      action,
      actorId: actor.id,
      actorRole: actor.role,
      reason: options.reason ?? null,
      createdAt: at,
    },
  });

  // Đơn đã giữ hàng mà không còn giao → trả hàng về kho. (late_pay_no_stock: hàng chưa được giữ lại.)
  if (RESTORES_STOCK.has(action)) {
    const items = await tx.orderItem.findMany({ where: { orderId } });
    await restoreStock(
      tx,
      items.map((i) => ({ productId: i.productId, qty: i.qty, variantId: i.variantId })),
    );
  }
  if (to === 'completed') await runCompletionHooks(tx, order);
  return order;
}
