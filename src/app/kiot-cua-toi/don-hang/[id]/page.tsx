import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eventLabel, OrderStatusBadge } from '@/components/orders/status';
import { getT } from '@/i18n/server';
import { formatDateTime, formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { getOrderForSeller, type Address } from '@/modules/orders';
import { SellerActions } from './SellerActions';

export const metadata: Metadata = { title: 'Chi tiết đơn', robots: { index: false } };

export default async function SellerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const [order, t] = await Promise.all([getOrderForSeller(user.id, (await params).id), getT()]);
  if (!order) notFound();
  const shipTo = order.shipTo as Address | null;
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-display text-xl font-black">{t('shop.order.title', { code: order.code })}</h1>
        <OrderStatusBadge status={order.status} />
      </header>
      <ul className="flex flex-col gap-1 rounded-[18px] border border-white/10 bg-white/5 p-4 text-[13px]">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3">
            <span>
              {i.name} × {i.qty}
            </span>
            <span>{formatVnd(i.price * i.qty)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t border-white/10 pt-1">
          <span>{t('seller.order.shipping')}</span>
          <span>{order.shippingFee ? formatVnd(order.shippingFee) : t('seller.order.free')}</span>
        </li>
        <li className="flex justify-between font-black">
          <span>{t('seller.order.total')}</span>
          <span className="text-brand">{formatVnd(order.total)}</span>
        </li>
      </ul>
      {order.note ? (
        <p className="rounded-[14px] border border-white/10 p-3 text-[13px]">
          {t('seller.order.note', { note: order.note })}
        </p>
      ) : null}
      <div className="rounded-[18px] border border-white/10 bg-white/5 p-4 text-[13px]" data-testid="ship-to">
        <h2 className="mb-1 font-black">{t('seller.order.shipTo')}</h2>
        {shipTo ? (
          <p>
            {shipTo.name} ·{' '}
            <a href={`tel:${shipTo.phone}`} className="text-brand">
              {'0' + shipTo.phone.replace(/^\+84/, '')}
            </a>
            <br />
            {shipTo.line}, {shipTo.ward}, {shipTo.district}, {shipTo.province}
          </p>
        ) : (
          <p className="text-white/60">{t('seller.order.afterPay')}</p>
        )}
        {order.trackingCode ? (
          <p className="mt-1">
            {t('shop.order.tracking', { code: order.trackingCode })}{' '}
            {order.carrier ? `(${order.carrier})` : ''}
          </p>
        ) : null}
      </div>
      <SellerActions orderId={order.id} status={order.status} />
      <div>
        <h2 className="mb-2 font-black">{t('seller.order.history')}</h2>
        <ol className="flex flex-col gap-1 text-[13px]" data-testid="order-timeline">
          {order.events.map((e) => (
            <li key={e.id}>
              <span className="text-white/50">{formatDateTime(e.createdAt, t.lang)}</span> —{' '}
              {eventLabel(t, e.action)}
              {e.reason ? `: ${e.reason}` : ''}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
