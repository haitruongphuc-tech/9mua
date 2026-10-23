import type { Order } from '@prisma/client';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { formatVnd } from '@/lib/format';
import { sendMail } from '@/lib/mail';
import { renderEmail } from '@/lib/mail/templates';
import type { OrderAction } from './state-machine';

const BUYER_MESSAGES: Partial<Record<OrderAction, (o: Order) => { subject: string; lines: string[] }>> = {
  confirm: (o) => ({
    subject: `Đơn ${o.code} đã được xác nhận`,
    lines: ['Người bán đã xác nhận và đang chuẩn bị hàng.'],
  }),
  ship: (o) => ({
    subject: `Đơn ${o.code} đang được giao`,
    lines: [
      o.trackingCode
        ? `Mã vận đơn: ${o.trackingCode}${o.carrier ? ` (${o.carrier})` : ''}.`
        : 'Người bán đã giao hàng cho đơn vị vận chuyển.',
      'Khi nhận được hàng, hãy bấm "Đã nhận hàng" trong mục Đơn mua.',
    ],
  }),
  reject: (o) => ({
    subject: `Đơn ${o.code} bị huỷ — 9MUA sẽ hoàn tiền`,
    lines: [`9MUA sẽ hoàn lại ${formatVnd(o.total)}. Hãy nhập tài khoản nhận hoàn tiền.`],
  }),
  seller_cancel: (o) => ({
    subject: `Đơn ${o.code} bị huỷ — 9MUA sẽ hoàn tiền`,
    lines: [`9MUA sẽ hoàn lại ${formatVnd(o.total)}. Hãy nhập tài khoản nhận hoàn tiền.`],
  }),
  auto_refund: (o) => ({
    subject: `Đơn ${o.code} bị huỷ vì người bán không xác nhận`,
    lines: [
      `Người bán không xác nhận trong 48 giờ. 9MUA sẽ hoàn lại ${formatVnd(o.total)}; hãy nhập tài khoản nhận hoàn tiền.`,
    ],
  }),
  auto_deliver: (o) => ({
    subject: `Đơn ${o.code} được ghi nhận đã giao`,
    lines: ['Đã 10 ngày kể từ khi giao. Nếu có vấn đề, bạn có 7 ngày để báo trong mục Đơn mua.'],
  }),
  mark_refunded: (o) => ({
    subject: `Đã hoàn tiền đơn ${o.code}`,
    lines: [
      `9MUA đã chuyển hoàn ${formatVnd(o.total)}${o.refundRef ? ` (mã giao dịch ${o.refundRef})` : ''}.`,
    ],
  }),
  resolve_refund: (o) => ({
    subject: `Khiếu nại đơn ${o.code}: bạn được hoàn tiền`,
    lines: [`9MUA sẽ hoàn lại ${formatVnd(o.total)}.`],
  }),
  resolve_release: (o) => ({
    subject: `Khiếu nại đơn ${o.code} đã được giải quyết`,
    lines: ['9MUA đã xem xét và ghi nhận đơn hoàn tất.'],
  }),
};

// Báo người mua khi đơn đổi trạng thái (chạy sau khi transaction đã commit).
export async function notifyBuyer(orderId: string, action: OrderAction): Promise<void> {
  const build = BUYER_MESSAGES[action];
  if (!build) return;
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const buyer = await db.user.findUniqueOrThrow({ where: { id: order.buyerId } });
  if (!buyer.email) return;
  const { subject, lines } = build(order);
  await sendMail({
    to: buyer.email,
    subject,
    ...renderEmail({
      title: subject,
      greeting: `Chào ${buyer.displayName},`,
      paragraphs: lines,
      action: { label: 'Xem đơn mua', url: `${env().APP_URL}/don-mua/${order.id}` },
    }),
  });
}
