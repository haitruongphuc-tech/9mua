import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { notifyBuyer } from './notify';
import type { OrderAction } from './state-machine';
import { applyAction, InvalidTransition } from './transition-core';

export type ActorInput = { userId: string; role: 'buyer' | 'seller' | 'admin' };
export type TransitionPayload = {
  reason?: string;
  trackingCode?: string;
  carrier?: string;
  refundRef?: string;
};
export type TransitionResult =
  | { ok: true }
  | { ok: false; error: 'NOT_FOUND' | 'INVALID_TRANSITION' | 'REASON_REQUIRED' | 'INVALID_INPUT' };

const NEEDS_REASON: ReadonlySet<OrderAction> = new Set([
  'reject',
  'seller_cancel',
  'dispute',
  'resolve_refund',
  'resolve_release',
]);

// Cửa vào duy nhất cho người mua/người bán/admin đổi trạng thái đơn: kiểm quyền sở hữu ở server,
// kiểm dữ liệu kèm theo, rồi applyAction trong transaction (SPEC-orders.md mục 13).
export async function transition(
  orderId: string,
  action: OrderAction,
  actor: ActorInput,
  payload: TransitionPayload = {},
): Promise<TransitionResult> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { buyerId: true, kiot: { select: { ownerId: true } } },
  });
  if (!order) return { ok: false, error: 'NOT_FOUND' };
  if (actor.role === 'seller' && order.kiot.ownerId !== actor.userId)
    return { ok: false, error: 'NOT_FOUND' };
  if (actor.role === 'buyer' && order.buyerId !== actor.userId) return { ok: false, error: 'NOT_FOUND' };

  const reason = payload.reason?.trim();
  if (NEEDS_REASON.has(action) && (!reason || reason.length < 5))
    return { ok: false, error: 'REASON_REQUIRED' };

  const data: Prisma.OrderUpdateInput = {};
  if (action === 'ship') {
    const tracking = payload.trackingCode?.trim() || null;
    const carrier = payload.carrier?.trim() || null;
    if ((tracking?.length ?? 0) > 60 || (carrier?.length ?? 0) > 60)
      return { ok: false, error: 'INVALID_INPUT' };
    Object.assign(data, { trackingCode: tracking, carrier });
  }
  if (action === 'mark_refunded') {
    const ref = payload.refundRef?.trim();
    if (!ref || ref.length > 60) return { ok: false, error: 'INVALID_INPUT' };
    data.refundRef = ref;
  }

  try {
    await db.$transaction((tx) =>
      applyAction(tx, orderId, action, { id: actor.userId, role: actor.role }, { reason, data }),
    );
  } catch (error) {
    if (error instanceof InvalidTransition) return { ok: false, error: 'INVALID_TRANSITION' };
    throw error;
  }
  await notifyBuyer(orderId, action).catch((e) => console.error('[orders] Gửi mail lỗi:', e));
  return { ok: true };
}

const SELLER_INCLUDE = {
  items: true,
  events: { orderBy: { createdAt: 'asc' } },
} as const satisfies Prisma.OrderInclude;

// Người bán chỉ thấy địa chỉ/SĐT người mua khi đơn đã từng được thanh toán (SPEC-orders.md mục 6).
function redact<T extends { paidAt: Date | null; shipTo: Prisma.JsonValue }>(order: T): T {
  return order.paidAt ? order : { ...order, shipTo: null };
}

export async function listOrdersForKiot(userId: string, filter: { status?: string[] }) {
  const orders = await db.order.findMany({
    where: {
      kiot: { ownerId: userId },
      ...(filter.status?.length ? { status: { in: filter.status as never[] } } : {}),
    },
    include: SELLER_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return orders.map(redact);
}

export async function getOrderForSeller(userId: string, orderId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId, kiot: { ownerId: userId } },
    include: SELLER_INCLUDE,
  });
  return order ? redact(order) : null;
}
