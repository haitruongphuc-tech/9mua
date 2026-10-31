import type { Metadata } from 'next';
import Image from 'next/image';
import { isFeatureOn } from '@/lib/features';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eventLabel, OrderStatusBadge } from '@/components/orders/status';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { now } from '@/lib/clock';
import { formatDateTime, formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { BANKS, findBank } from '@/modules/kiot';
import { DISPUTE_WINDOW_DAYS, getOrderForBuyer } from '@/modules/orders';
import { receiveAction } from '../actions';
import { DisputeForm, RefundAccountForm } from './BuyerForms';

export const metadata: Metadata = { title: 'Chi tiết đơn mua', robots: { index: false } };

export default async function BuyerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const [order, t] = await Promise.all([getOrderForBuyer(user.id, (await params).id), getT()]);
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
  const total = formatVnd(order.total);
  const reviewsOn = await isFeatureOn('reviews');

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-black">{t('shop.order.title', { code: order.code })}</h1>
        <OrderStatusBadge status={order.status} />
      </header>
      <p className="text-[13px] text-white/60">
        {t('shop.order.kiot', { name: order.kiot.name })} ·{' '}
        <a href={`tel:${order.kiot.contactPhone}`} className="font-bold text-brand">
          {t('shop.order.call')}
        </a>
      </p>
      <ul className="flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-4 text-[13px]">
        {order.items.map((i) => (
          <li key={i.id} className="flex items-center gap-3">
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-white/10">
              {i.imageUrl ? (
                <Image src={i.imageUrl} alt="" fill sizes="48px" className="object-cover" unoptimized />
              ) : null}
            </span>
            <span className="flex-1">
              {i.name} × {i.qty}
            </span>
            <span>{formatVnd(i.price * i.qty)}</span>
            {reviewsOn && (order.status === 'delivered' || order.status === 'completed') ? (
              <Link
                href={`/don-mua/${order.id}/danh-gia/${i.id}`}
                className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold"
                data-testid="review-link"
              >
                ★ {t('shop.review.link')}
              </Link>
            ) : null}
          </li>
        ))}
        <li className="flex justify-between border-t border-white/10 pt-2 font-black">
          <span>{t('shop.order.total', { fee: formatVnd(order.shippingFee) })}</span>
          <span className="text-brand">{total}</span>
        </li>
      </ul>
      {order.trackingCode ? (
        <p className="text-[13px]">
          {t('shop.order.tracking', { code: order.trackingCode })} {order.carrier ? `(${order.carrier})` : ''}
        </p>
      ) : null}

      {order.status === 'shipping' ? (
        <form action={receiveAction.bind(null, order.id)}>
          <button
            className="h-12 w-full rounded-full bg-brand font-black text-white"
            data-testid="receive-order"
          >
            {t('shop.order.received')}
          </button>
        </form>
      ) : null}
      <ClientMessages prefixes={['shop.dispute.', 'shop.refund.', 'seller.img.']}>
        {canDispute ? <DisputeForm orderId={order.id} /> : null}
        {order.status === 'refund_pending' && !refund ? (
          <RefundAccountForm orderId={order.id} banks={BANKS} />
        ) : null}
      </ClientMessages>
      {order.status === 'disputed' && order.dispute ? (
        <p className="rounded-[14px] bg-danger/20 px-4 py-3 text-[13px]">
          {t('shop.order.disputeOpen', { message: order.dispute.message })}
        </p>
      ) : null}
      {order.status === 'refund_pending' && refund ? (
        <p className="rounded-[14px] bg-success/20 px-4 py-3 text-[13px]" data-testid="refund-info">
          {t('shop.order.refundTo', {
            total,
            bank: findBank(refund.bankBin)?.shortName ?? '',
            number: refund.accountNumber,
            name: refund.accountName,
          })}
        </p>
      ) : null}
      {order.status === 'refunded' ? (
        <p className="rounded-[14px] bg-success/20 px-4 py-3 text-[13px]">
          {order.refundRef
            ? t('shop.order.refundedRef', { total, ref: order.refundRef })
            : t('shop.order.refunded', { total })}
        </p>
      ) : null}

      <div>
        <h2 className="mb-2 font-black">{t('shop.order.history')}</h2>
        <ol className="flex flex-col gap-1 text-[13px]" data-testid="buyer-timeline">
          {order.events.map((e) => (
            <li key={e.id}>
              <span className="text-white/50">{formatDateTime(e.createdAt, t.lang)}</span> —{' '}
              {eventLabel(t, e.action)}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
