import { PartyPopper } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PaymentQr } from '@/components/payments/PaymentQr';
import { getT } from '@/i18n/server';
import { formatDateVN, formatVnd } from '@/lib/format';
import { kiotOrigin } from '@/lib/urls';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';
import { getPayment } from '@/server/payments';
import { startKiotPaymentAction } from '../actions';

export const metadata: Metadata = { title: 'Thanh toán phí thuê Kiot', robots: { index: false } };

export default async function KiotPaymentPage({ params }: { params: Promise<{ intentId: string }> }) {
  const user = await requireUser();
  const kiot = await getKiotByOwner(user.id);
  const intent = kiot ? await getPayment((await params).intentId, { reconcile: true }) : null;
  if (!kiot || !intent || intent.purpose !== 'kiot_fee' || intent.refId !== kiot.id) notFound();
  const t = await getT();

  if (intent.status === 'paid') {
    const fresh = await getKiotByOwner(user.id);
    return (
      <section
        className="flex flex-col items-center gap-4 px-4 py-10 text-center"
        data-testid="payment-success"
      >
        <PartyPopper className="h-12 w-12 text-brand" aria-hidden />
        <h1 className="font-display text-[22px] font-black">{t('seller.kpay.successTitle')}</h1>
        <p className="text-white/70">
          {t('seller.kpay.successText', { amount: formatVnd(intent.amount), name: kiot.name })}{' '}
          <strong data-testid="active-until">
            {fresh?.activeUntil ? formatDateVN(fresh.activeUntil) : ''}
          </strong>
          .
        </p>
        <a
          href={kiotOrigin(kiot.slug)}
          className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-[14px] font-black"
        >
          {t('seller.kpay.viewKiot')}
        </a>
        <Link href="/kiot-cua-toi" className="font-bold text-brand underline">
          {t('seller.kpay.back')}
        </Link>
      </section>
    );
  }

  if (intent.status !== 'pending') {
    return (
      <section className="flex flex-col items-center gap-4 px-4 py-10 text-center">
        <h1 className="font-display text-xl font-black">
          {t(intent.status === 'mismatch' ? 'seller.kpay.mismatch' : 'seller.kpay.expired')}
        </h1>
        {intent.status !== 'mismatch' ? (
          <form action={startKiotPaymentAction}>
            <button className="h-11 rounded-full bg-brand px-6 font-black text-white">
              {t('seller.kpay.newCode')}
            </button>
          </form>
        ) : null}
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-xl font-black">{t('seller.kpay.title', { name: kiot.name })}</h1>
      <p className="text-[13px] text-white/60">{t('seller.kpay.text')}</p>
      <PaymentQr intent={intent} statusUrl={`/api/kiot/payment/${intent.intentId}`} />
    </section>
  );
}
