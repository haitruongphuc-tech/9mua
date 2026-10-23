import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ACTION_LABELS, OrderStatusBadge } from '@/components/orders/status';
import { formatDateTimeVN, formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { getOrderForSeller, type Address } from '@/modules/orders';
import { SellerActions } from './SellerActions';

export const metadata: Metadata = { title: 'Chi tiết đơn', robots: { index: false } };

export default async function SellerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const order = await getOrderForSeller(user.id, (await params).id);
  if (!order) notFound();
  const shipTo = order.shipTo as Address | null;
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">Đơn {order.code}</h1>
        <OrderStatusBadge status={order.status} />
      </header>
      <ul className="flex flex-col gap-1 rounded-2xl bg-surface-muted p-4 text-sm">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3">
            <span>
              {i.name} × {i.qty}
            </span>
            <span>{formatVnd(i.price * i.qty)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t border-black/10 pt-1">
          <span>Phí ship</span>
          <span>{order.shippingFee ? formatVnd(order.shippingFee) : 'Miễn phí'}</span>
        </li>
        <li className="flex justify-between font-extrabold">
          <span>Tổng (9MUA thu hộ)</span>
          <span>{formatVnd(order.total)}</span>
        </li>
      </ul>
      {order.note ? (
        <p className="rounded-xl border-2 border-black/10 p-3 text-sm">Ghi chú của khách: {order.note}</p>
      ) : null}
      <div className="rounded-2xl border-2 border-black/10 p-4 text-sm" data-testid="ship-to">
        <h2 className="mb-1 font-extrabold">Giao tới</h2>
        {shipTo ? (
          <p>
            {shipTo.name} · <a href={`tel:${shipTo.phone}`}>{'0' + shipTo.phone.replace(/^\+84/, '')}</a>
            <br />
            {shipTo.line}, {shipTo.ward}, {shipTo.district}, {shipTo.province}
          </p>
        ) : (
          <p className="text-black/60">Hiện sau khi khách thanh toán.</p>
        )}
        {order.trackingCode ? (
          <p className="mt-1">
            Mã vận đơn: {order.trackingCode} {order.carrier ? `(${order.carrier})` : ''}
          </p>
        ) : null}
      </div>
      <SellerActions orderId={order.id} status={order.status} />
      <div>
        <h2 className="mb-2 font-extrabold">Lịch sử</h2>
        <ol className="flex flex-col gap-1 text-sm" data-testid="order-timeline">
          {order.events.map((e) => (
            <li key={e.id}>
              <span className="text-black/60">{formatDateTimeVN(e.createdAt)}</span> —{' '}
              {ACTION_LABELS[e.action] ?? e.action}
              {e.reason ? `: ${e.reason}` : ''}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
