import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PaymentQr } from '@/components/payments/PaymentQr';
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

  if (intent.status === 'paid') {
    const fresh = await getKiotByOwner(user.id);
    return (
      <section
        className="flex flex-col items-center gap-4 px-4 py-10 text-center"
        data-testid="payment-success"
      >
        <p className="text-5xl" aria-hidden>
          🎉
        </p>
        <h1 className="text-2xl font-extrabold">Kiot đã hoạt động!</h1>
        <p className="text-black/70">
          Đã nhận {formatVnd(intent.amount)}. {kiot.name} hoạt động đến{' '}
          <strong data-testid="active-until">
            {fresh?.activeUntil ? formatDateVN(fresh.activeUntil) : ''}
          </strong>
          .
        </p>
        <a
          href={kiotOrigin(kiot.slug)}
          className="rounded-full border-2 border-brand-ink bg-brand px-6 py-3 font-extrabold text-brand-ink"
        >
          Xem trang Kiot
        </a>
        <Link href="/kiot-cua-toi" className="font-bold text-brand-deep underline">
          Về trang quản lý
        </Link>
      </section>
    );
  }

  if (intent.status !== 'pending') {
    const message =
      intent.status === 'mismatch'
        ? 'Số tiền nhận được không khớp. 9MUA sẽ liên hệ để xử lý, bạn không cần chuyển thêm.'
        : 'Mã thanh toán đã hết hạn hoặc đã huỷ.';
    return (
      <section className="flex flex-col items-center gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-extrabold">{message}</h1>
        {intent.status !== 'mismatch' ? (
          <form action={startKiotPaymentAction}>
            <button className="rounded-full border-2 border-brand-ink bg-brand px-6 py-3 font-extrabold text-brand-ink">
              Tạo mã mới
            </button>
          </form>
        ) : null}
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-extrabold">Kích hoạt {kiot.name}</h1>
      <p className="text-sm text-black/70">
        Phí thuê 1 năm. Trả xong Kiot tự hiện công khai, không cần chờ duyệt.
      </p>
      <PaymentQr intent={intent} statusUrl={`/api/kiot/payment/${intent.intentId}`} />
    </section>
  );
}
