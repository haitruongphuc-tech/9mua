import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderStatusBadge } from '@/components/orders/status';
import { getT } from '@/i18n/server';
import { formatDateTime, formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { listOrdersForKiot } from '@/modules/orders';

export const metadata: Metadata = { title: 'Đơn hàng', robots: { index: false } };

const TABS = [
  { key: 'can-xac-nhan', status: ['paid'] },
  { key: 'chuan-bi', status: ['confirmed'] },
  { key: 'dang-giao', status: ['shipping'] },
  { key: 'da-giao', status: ['delivered', 'completed'] },
  { key: 'hoan-huy', status: ['refund_pending', 'refunded', 'cancelled', 'disputed'] },
  { key: 'tat-ca', status: [] as string[] },
] as const;

export default async function SellerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const key = (await searchParams).tab ?? 'can-xac-nhan';
  const tab = TABS.find((x) => x.key === key) ?? TABS[0];
  const [orders, t] = await Promise.all([listOrdersForKiot(user.id, { status: [...tab.status] }), getT()]);
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-xl font-black">{t('seller.orders.title')}</h1>
      <nav
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4"
        aria-label={t('seller.orders.filter')}
      >
        {TABS.map((x) => (
          <Link
            key={x.key}
            href={`/kiot-cua-toi/don-hang?tab=${x.key}`}
            aria-current={x.key === tab.key ? 'page' : undefined}
            className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-[13px] font-bold aria-[current=page]:border-brand aria-[current=page]:bg-brand"
          >
            {t(`seller.orders.tab.${x.key}`)}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <p className="rounded-[18px] border border-white/10 bg-white/5 p-6 text-center text-white/60">
          {t('seller.orders.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="seller-orders">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/kiot-cua-toi/don-hang/${o.id}`}
                className="flex flex-col gap-1 rounded-[18px] border border-white/10 bg-white/5 p-3 hover:bg-white/10"
              >
                <span className="flex items-center justify-between gap-2">
                  <strong className="text-[14px]">{o.code}</strong>
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
