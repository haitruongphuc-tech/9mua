import type { Metadata } from 'next';
import Link from 'next/link';
import { OrderStatusBadge } from '@/components/orders/status';
import { formatDateTimeVN, formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { listOrdersForBuyer } from '@/modules/orders';

export const metadata: Metadata = { title: 'Đơn mua', robots: { index: false } };

export default async function BuyerOrdersPage() {
  const user = await requireUser();
  const orders = await listOrdersForBuyer(user.id);
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-extrabold">Đơn mua</h1>
      {orders.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70">Bạn chưa có đơn nào.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10" data-testid="buyer-orders">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/don-mua/${o.id}`} className="flex flex-col gap-1 py-3">
                <span className="flex items-center justify-between gap-2">
                  <strong>
                    {o.code} · {o.kiot.name}
                  </strong>
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
