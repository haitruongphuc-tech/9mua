import type { OrderStatus } from '@prisma/client';

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
  pending_payment: 'bg-black/10',
  paid: 'bg-brand/30',
  confirmed: 'bg-brand/20',
  shipping: 'bg-brand/20',
  delivered: 'bg-success/15 text-success',
  completed: 'bg-success/15 text-success',
  cancelled: 'bg-black/10',
  refund_pending: 'bg-danger/10 text-danger',
  refunded: 'bg-black/10',
  disputed: 'bg-danger/10 text-danger',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      data-testid="order-status"
      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export const ACTION_LABELS: Record<string, string> = {
  place: 'Đặt hàng',
  pay: 'Thanh toán',
  cancel: 'Người mua huỷ',
  expire: 'Tự huỷ (quá hạn thanh toán)',
  late_pay: 'Thanh toán muộn',
  late_pay_no_stock: 'Thanh toán muộn — hết hàng',
  confirm: 'Người bán xác nhận',
  reject: 'Người bán từ chối',
  auto_refund: 'Tự huỷ (người bán không xác nhận 48 giờ)',
  ship: 'Đã giao cho shipper',
  seller_cancel: 'Người bán huỷ',
  receive: 'Người mua đã nhận',
  auto_deliver: 'Tự ghi nhận đã giao (10 ngày)',
  dispute: 'Người mua khiếu nại',
  complete: 'Hoàn tất',
  resolve_refund: '9MUA xử khiếu nại: hoàn tiền',
  resolve_release: '9MUA xử khiếu nại: trả người bán',
  mark_refunded: '9MUA đã hoàn tiền',
};
