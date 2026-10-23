import type { OrderStatus } from '@prisma/client';

export type ActorRole = 'buyer' | 'seller' | 'admin' | 'system';

export const ORDER_STATUSES: OrderStatus[] = [
  'pending_payment',
  'paid',
  'confirmed',
  'shipping',
  'delivered',
  'completed',
  'cancelled',
  'refund_pending',
  'refunded',
  'disputed',
];

// Bảng chuyển trạng thái duy nhất của đơn hàng (sơ đồ trong SPEC-orders.md). Ngoài bảng này → từ chối.
export const TRANSITIONS = {
  pay: { from: ['pending_payment'], to: 'paid', roles: ['system'] },
  cancel: { from: ['pending_payment'], to: 'cancelled', roles: ['buyer'] },
  expire: { from: ['pending_payment'], to: 'cancelled', roles: ['system'] },
  late_pay: { from: ['cancelled'], to: 'paid', roles: ['system'] },
  late_pay_no_stock: { from: ['cancelled'], to: 'refund_pending', roles: ['system'] },
  confirm: { from: ['paid'], to: 'confirmed', roles: ['seller'] },
  reject: { from: ['paid'], to: 'refund_pending', roles: ['seller'] },
  auto_refund: { from: ['paid'], to: 'refund_pending', roles: ['system'] },
  ship: { from: ['confirmed'], to: 'shipping', roles: ['seller'] },
  seller_cancel: { from: ['confirmed'], to: 'refund_pending', roles: ['seller'] },
  receive: { from: ['shipping'], to: 'delivered', roles: ['buyer'] },
  auto_deliver: { from: ['shipping'], to: 'delivered', roles: ['system'] },
  dispute: { from: ['delivered'], to: 'disputed', roles: ['buyer'] },
  complete: { from: ['delivered'], to: 'completed', roles: ['system'] },
  resolve_refund: { from: ['disputed'], to: 'refund_pending', roles: ['admin'] },
  resolve_release: { from: ['disputed'], to: 'completed', roles: ['admin'] },
  mark_refunded: { from: ['refund_pending'], to: 'refunded', roles: ['admin'] },
} as const satisfies Record<
  string,
  { from: readonly OrderStatus[]; to: OrderStatus; roles: readonly ActorRole[] }
>;

export type OrderAction = keyof typeof TRANSITIONS;

export function nextStatus(from: OrderStatus, action: OrderAction, role: ActorRole): OrderStatus | null {
  const rule = TRANSITIONS[action];
  if (!rule) return null;
  const fromOk = (rule.from as readonly OrderStatus[]).includes(from);
  const roleOk = (rule.roles as readonly ActorRole[]).includes(role);
  return fromOk && roleOk ? rule.to : null;
}

// Các hành động trả hàng về kho (đơn không còn được giao).
export const RESTORES_STOCK: ReadonlySet<OrderAction> = new Set<OrderAction>([
  'cancel',
  'expire',
  'reject',
  'auto_refund',
  'seller_cancel',
]);

// Mốc thời gian ghi kèm khi vào trạng thái.
export const TIMESTAMP_FIELD: Partial<
  Record<
    OrderStatus,
    'paidAt' | 'confirmedAt' | 'shippedAt' | 'deliveredAt' | 'completedAt' | 'cancelledAt' | 'refundedAt'
  >
> = {
  paid: 'paidAt',
  confirmed: 'confirmedAt',
  shipping: 'shippedAt',
  delivered: 'deliveredAt',
  completed: 'completedAt',
  cancelled: 'cancelledAt',
  refunded: 'refundedAt',
};
