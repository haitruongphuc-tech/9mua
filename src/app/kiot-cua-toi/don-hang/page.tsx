import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderStatusBadge } from '@/components/orders/status';
import { formatDateTimeVN, formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { listOrdersForKiot } from '@/modules/orders';

export const metadata: Metadata = { title: 'Đơn hàng', robots: { index: false } };

const TABS = [
  { key: 'can-xac-nhan', label: 'Cần xác nhận', status: ['paid'] },
  { key: 'chuan-bi', label: 'Đang chuẩn bị', status: ['confirmed'] },
  { key: 'dang-giao', label: 'Đang giao', status: ['shipping'] },
  { key: 'da-giao', label: 'Đã giao', status: ['delivered', 'completed'] },
  {
    key: 'hoan-huy',
    label: 'Huỷ / hoàn / khiếu nại',
    status: ['refund_pending', 'refunded', 'cancelled', 'disputed'],
  },
  { key: 'tat-ca', label: 'Tất cả', status: [] as string[] },
];

export default async function SellerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const key = (await searchParams).tab ?? 'can-xac-nhan';
  const tab = TABS.find((t) => t.key === key) ?? TABS[0]!;
  const orders = await listOrdersForKiot(user.id, { status: tab.status });
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-extrabold">Đơn hàng</h1>
      <nav className="flex gap-2 overflow-x-auto" aria-label="Lọc đơn">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/kiot-cua-toi/don-hang?tab=${t.key}`}
            aria-current={t.key === tab.key ? 'page' : undefined}
            className="shrink-0 rounded-full border-2 border-black/10 px-3 py-1 text-sm font-bold aria-[current=page]:border-brand-ink aria-[current=page]:bg-brand"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70">Không có đơn nào.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10" data-testid="seller-orders">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/kiot-cua-toi/don-hang/${o.id}`} className="flex flex-col gap-1 py-3">
                <span className="flex items-center justify-between gap-2">
                  <strong>{o.code}</strong>
                  <OrderStatusBadge status={o.status} />
                </span>
                <span className="truncate text-sm text-black/70">
                  {o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}
                </span>
                <span className="flex justify-between text-sm">
                  <span className="text-black/60">{formatDateTimeVN(o.createdAt)}</span>
                  <strong>{formatVnd(o.total)}</strong>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
