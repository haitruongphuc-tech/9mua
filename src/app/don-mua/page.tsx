import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderStatusBadge } from '@/components/orders/status';
import { getT } from '@/i18n/server';
import { formatDateTime, formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { listOrdersForBuyer } from '@/modules/orders';

export const metadata: Metadata = { title: 'Đơn mua', robots: { index: false } };

export default async function BuyerOrdersPage() {
  const user = await requireUser();
  const [orders, t] = await Promise.all([listOrdersForBuyer(user.id), getT()]);
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-[22px] font-black">{t('shop.orders.title')}</h1>
      {orders.length === 0 ? (
        <p className="rounded-[18px] border border-white/10 bg-white/5 p-6 text-center text-white/60">
          {t('shop.orders.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="buyer-orders">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/don-mua/${o.id}`}
                className="flex flex-col gap-1 rounded-[18px] border border-white/10 bg-white/5 p-3 hover:bg-white/10"
              >
                <span className="flex items-center justify-between gap-2">
                  <strong className="min-w-0 truncate text-[14px]">
                    {o.code} · {o.kiot.name}
                  </strong>
                  <OrderStatusBadge status={o.status} />
                </span>
                <span className="truncate text-[12px] text-white/60">
                  {o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}
                </span>
                <span className="flex justify-between text-[12px]">
                  <span className="text-white/50">{formatDateTime(o.createdAt, t.lang)}</span>
                  <strong className="text-brand">{formatVnd(o.total)}</strong>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
