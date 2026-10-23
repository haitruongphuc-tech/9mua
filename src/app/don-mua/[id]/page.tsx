import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ACTION_LABELS, OrderStatusBadge } from '@/components/orders/status';
import { now } from '@/lib/clock';
import { formatDateTimeVN, formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { BANKS, findBank } from '@/modules/kiot';
import { DISPUTE_WINDOW_DAYS, getOrderForBuyer } from '@/modules/orders';
import { receiveAction } from '../actions';
import { DisputeForm, RefundAccountForm } from './BuyerForms';

export const metadata: Metadata = { title: 'Chi tiết đơn mua', robots: { index: false } };

export default async function BuyerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const order = await getOrderForBuyer(user.id, (await params).id);
  if (!order) notFound();
  const canDispute =
    order.status === 'delivered' &&
    order.deliveredAt &&
    now().getTime() - order.deliveredAt.getTime() <= DISPUTE_WINDOW_DAYS * 86_400_000;
  const refund = order.refundAccount as {
    bankBin: string;
    accountNumber: string;
    accountName: string;
  } | null;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">Đơn {order.code}</h1>
        <OrderStatusBadge status={order.status} />
      </header>
      <p className="text-sm text-black/70">
        Kiot {order.kiot.name} · <a href={`tel:${order.kiot.contactPhone}`}>Gọi người bán</a>
      </p>
      <ul className="flex flex-col gap-2 rounded-2xl bg-surface-muted p-4 text-sm">
        {order.items.map((i) => (
          <li key={i.id} className="flex items-center gap-3">
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
              {i.imageUrl ? (
                <Image src={i.imageUrl} alt="" fill sizes="48px" className="object-cover" unoptimized />
              ) : null}
            </span>
            <span className="flex-1">
              {i.name} × {i.qty}
            </span>
            <span>{formatVnd(i.price * i.qty)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t border-black/10 pt-2 font-extrabold">
          <span>Tổng (gồm ship {formatVnd(order.shippingFee)})</span>
          <span>{formatVnd(order.total)}</span>
        </li>
      </ul>
      {order.trackingCode ? (
        <p className="text-sm">
          Mã vận đơn: {order.trackingCode} {order.carrier ? `(${order.carrier})` : ''}
        </p>
      ) : null}

      {order.status === 'shipping' ? (
        <form action={receiveAction.bind(null, order.id)}>
          <button
            className="h-12 w-full rounded-full border-2 border-brand-ink bg-brand font-extrabold text-brand-ink"
            data-testid="receive-order"
          >
            Đã nhận hàng
          </button>
        </form>
      ) : null}
      {canDispute ? <DisputeForm orderId={order.id} /> : null}
      {order.status === 'disputed' && order.dispute ? (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm">
          Khiếu nại đang được 9MUA xem xét: “{order.dispute.message}”
        </p>
      ) : null}
      {order.status === 'refund_pending' ? (
        refund ? (
          <p className="rounded-xl bg-success/10 px-4 py-3 text-sm" data-testid="refund-info">
            9MUA sẽ hoàn {formatVnd(order.total)} vào {findBank(refund.bankBin)?.shortName} ·{' '}
            {refund.accountNumber} · {refund.accountName}.
          </p>
        ) : (
          <RefundAccountForm orderId={order.id} banks={BANKS} />
        )
      ) : null}
      {order.status === 'refunded' ? (
        <p className="rounded-xl bg-success/10 px-4 py-3 text-sm">
          Đã hoàn {formatVnd(order.total)}
          {order.refundRef ? ` (mã giao dịch ${order.refundRef})` : ''}.
        </p>
      ) : null}

      <div>
        <h2 className="mb-2 font-extrabold">Lịch sử đơn</h2>
        <ol className="flex flex-col gap-1 text-sm" data-testid="buyer-timeline">
          {order.events.map((e) => (
            <li key={e.id}>
              <span className="text-black/60">{formatDateTimeVN(e.createdAt)}</span> —{' '}
              {ACTION_LABELS[e.action] ?? e.action}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
