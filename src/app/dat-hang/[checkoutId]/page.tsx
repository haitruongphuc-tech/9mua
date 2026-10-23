import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PaymentQr } from '@/components/payments/PaymentQr';
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

  if (checkout.status === 'paid' || intent?.status === 'paid') {
    return (
      <section className="flex flex-col items-center gap-4 px-4 py-10 text-center" data-testid="order-paid">
        <p className="text-5xl" aria-hidden>
          ✅
        </p>
        <h1 className="text-2xl font-extrabold">Đã thanh toán</h1>
        <p className="text-black/70">
          Đơn {codes} đã được thanh toán {formatVnd(checkout.total)}. Người bán sẽ xác nhận trong 48 giờ.
        </p>
        <Link
          href="/don-mua"
          className="rounded-full border-2 border-brand-ink bg-brand px-6 py-3 font-extrabold text-brand-ink"
        >
          Xem đơn mua
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
        <h1 className="text-xl font-extrabold">Đơn {codes} đã huỷ</h1>
        <p className="text-black/70">
          {intent?.status === 'mismatch'
            ? 'Số tiền nhận được không khớp. 9MUA sẽ liên hệ để xử lý.'
            : 'Đơn chưa được thanh toán trong 15 phút hoặc bạn đã huỷ. Hàng đã được trả về Kiot.'}
        </p>
        <Link href="/gio-hang" className="font-bold text-brand-deep underline">
          Về giỏ hàng
        </Link>
      </section>
    );
  }
  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-extrabold">Thanh toán đơn {codes}</h1>
      <PaymentQr intent={intent} statusUrl={`/api/orders/payment/${checkout.id}`} />
      <form action={cancelCheckoutAction.bind(null, checkout.id)}>
        <button className="w-full py-2 text-sm font-bold text-danger" data-testid="cancel-checkout">
          Huỷ đơn
        </button>
      </form>
    </section>
  );
}
