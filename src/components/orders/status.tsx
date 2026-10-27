import type { OrderStatus } from '@prisma/client';
import { getT, type T } from '@/i18n/server';

// Nhãn tiếng Việt cho trang admin (SPEC-i18n.md mục 9: admin chỉ cần tiếng Việt).
export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Chờ thanh toán',
  paid: 'Đã thanh toán — chờ xác nhận',
  confirmed: 'Đã xác nhận — đang chuẩn bị',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã huỷ',
  refund_pending: 'Chờ hoàn tiền',
  refunded: 'Đã hoàn tiền',
  disputed: 'Đang khiếu nại',
};

const TONE: Record<OrderStatus, string> = {
  pending_payment: 'bg-white/10',
  paid: 'bg-brand/30',
  confirmed: 'bg-brand/20',
  shipping: 'bg-brand/20',
  delivered: 'bg-success/20 text-green-300',
  completed: 'bg-success/20 text-green-300',
  cancelled: 'bg-white/10',
  refund_pending: 'bg-danger/20 text-red-300',
  refunded: 'bg-white/10',
  disputed: 'bg-danger/20 text-red-300',
};

export async function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = await getT();
  return (
    <span
      data-testid="order-status"
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${TONE[status]}`}
    >
      {t(`shop.status.${status}`)}
    </span>
  );
}

const EVENTS = [
  'place',
  'pay',
  'cancel',
  'expire',
  'late_pay',
  'late_pay_no_stock',
  'confirm',
  'reject',
  'auto_refund',
  'ship',
  'seller_cancel',
  'receive',
  'auto_deliver',
  'dispute',
  'complete',
  'resolve_refund',
  'resolve_release',
  'mark_refunded',
] as const;
type EventAction = (typeof EVENTS)[number];
const isEvent = (a: string): a is EventAction => (EVENTS as readonly string[]).includes(a);

// Một dòng trong lịch sử đơn (OrderEvent.action) theo ngôn ngữ đang chọn.
export const eventLabel = (t: T, action: string) => (isEvent(action) ? t(`shop.event.${action}`) : action);
