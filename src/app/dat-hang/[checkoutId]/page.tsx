import { CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PaymentQr } from '@/components/payments/PaymentQr';
import { getT } from '@/i18n/server';
import { formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { getCheckoutForBuyer } from '@/modules/orders';
import { getPayment } from '@/server/payments';
import { cancelCheckoutAction } from '../actions';

export const metadata: Metadata = { title: 'Thanh toán đơn hàng', robots: { index: false } };

export default async function OrderPaymentPage({ params }: { params: Promise<{ checkoutId: string }> }) {
  const user = await requireUser();
  const { checkoutId } = await params;
  let checkout = await getCheckoutForBuyer(user.id, checkoutId);
  if (!checkout) notFound();
  const intent = checkout.intentId ? await getPayment(checkout.intentId, { reconcile: true }) : null;
  checkout = (await getCheckoutForBuyer(user.id, checkoutId))!;
  const codes = checkout.orders.map((o) => o.code).join(', ');
  const t = await getT();

  if (checkout.status === 'paid' || intent?.status === 'paid') {
    return (
      <section className="flex flex-col items-center gap-4 px-4 py-10 text-center" data-testid="order-paid">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" aria-hidden />
        <h1 className="font-display text-[22px] font-black">{t('shop.pay.paidTitle')}</h1>
        <p className="text-white/70">{t('shop.pay.paidText', { codes, total: formatVnd(checkout.total) })}</p>
        <Link
          href="/don-mua"
          className="inline-flex h-11 items-center rounded-full bg-brand px-6 text-[13px] font-black"
        >
          {t('shop.pay.viewOrders')}
        </Link>
      </section>
    );
  }
  if (checkout.status === 'cancelled' || !intent || intent.status !== 'pending') {
    return (
      <section
        className="flex flex-col items-center gap-4 px-4 py-10 text-center"
        data-testid="order-cancelled"
      >
        <h1 className="font-display text-xl font-black">{t('shop.pay.cancelledTitle', { codes })}</h1>
        <p className="text-white/70">
          {intent?.status === 'mismatch' ? t('shop.pay.mismatch') : t('shop.pay.expired')}
        </p>
        <Link href="/gio-hang" className="font-bold text-brand underline">
          {t('shop.pay.backToCart')}
        </Link>
      </section>
    );
  }
  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-xl font-black">{t('shop.pay.title', { codes })}</h1>
      <PaymentQr intent={intent} statusUrl={`/api/orders/payment/${checkout.id}`} />
      <form action={cancelCheckoutAction.bind(null, checkout.id)}>
        <button className="w-full py-2 text-[13px] font-bold text-red-400" data-testid="cancel-checkout">
          {t('shop.pay.cancel')}
        </button>
      </form>
    </section>
  );
}
