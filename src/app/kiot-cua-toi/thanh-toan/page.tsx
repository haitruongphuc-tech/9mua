import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { formatDateVN, formatVnd } from '@/lib/format';
import { getKiotBilling } from '@/modules/billing';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';

export const metadata: Metadata = { title: 'Lịch sử thanh toán', robots: { index: false } };

export default async function KiotPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ 'tu-payos'?: string }>;
}) {
  const user = await requireUser();
  const kiot = await getKiotByOwner(user.id);
  if (!kiot) redirect('/kiot-cua-toi/tao');

  // Quay về từ trang PayOS: mở thẳng khoản thanh toán gần nhất.
  if ((await searchParams)['tu-payos']) {
    const latest = await db.paymentIntent.findFirst({
      where: { purpose: 'kiot_fee', refId: kiot.id },
      orderBy: { createdAt: 'desc' },
    });
    if (latest) redirect(`/kiot-cua-toi/thanh-toan/${latest.id}`);
  }

  const { history } = await getKiotBilling(kiot.id);
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-extrabold">Lịch sử thanh toán phí thuê</h1>
      {history.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70">Chưa có thanh toán nào.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10" data-testid="billing-history">
          {history.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 py-3">
              <span>
                <span className="block font-bold">
                  {formatDateVN(h.periodStart)} – {formatDateVN(h.periodEnd)}
                </span>
                <span className="text-sm text-black/60">
                  {h.source === 'payos' ? 'Thanh toán PayOS' : `9MUA tặng${h.note ? `: ${h.note}` : ''}`}
                </span>
              </span>
              <span className="font-extrabold">{h.amount ? formatVnd(h.amount) : 'Miễn phí'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
