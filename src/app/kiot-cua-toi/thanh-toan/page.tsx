import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
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

  const [{ history }, t] = await Promise.all([getKiotBilling(kiot.id), getT()]);
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-xl font-black">{t('seller.bill.title')}</h1>
      {history.length === 0 ? (
        <p className="rounded-[18px] border border-white/10 bg-white/5 p-6 text-center text-white/60">
          {t('seller.bill.empty')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-white/10" data-testid="billing-history">
          {history.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 py-3">
              <span>
                <span className="block font-bold">
                  {formatDateVN(h.periodStart)} – {formatDateVN(h.periodEnd)}
                </span>
                <span className="text-[13px] text-white/60">
                  {h.source === 'payos'
                    ? t('seller.bill.payos')
                    : h.note
                      ? t('seller.bill.giftNote', { note: h.note })
                      : t('seller.bill.gift')}
                </span>
              </span>
              <span className="font-black">{h.amount ? formatVnd(h.amount) : t('seller.bill.free')}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
