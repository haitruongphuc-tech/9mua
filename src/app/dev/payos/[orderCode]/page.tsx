import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { formatVnd } from '@/lib/format';
import { simulateAction } from './actions';

export const dynamic = 'force-dynamic';

// Trang giả lập PayOS cho dev/E2E. Chỉ tồn tại khi PAYMENTS_DRIVER=fake (production bị chặn ở env.ts).
export default async function FakePayosPage({ params }: { params: Promise<{ orderCode: string }> }) {
  if (env().PAYMENTS_DRIVER !== 'fake') notFound();
  const orderCode = Number((await params).orderCode);
  if (!Number.isSafeInteger(orderCode)) notFound();
  const intent = await db.paymentIntent.findUnique({ where: { orderCode: BigInt(orderCode) } });
  if (!intent) notFound();
  const act = simulateAction.bind(null, orderCode);
  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <p className="rounded-xl bg-danger/10 px-4 py-2 text-sm font-bold text-danger">
        PayOS GIẢ LẬP — chỉ dùng khi thử nghiệm
      </p>
      <h1 className="text-2xl font-extrabold">Thanh toán {formatVnd(intent.amount)}</h1>
      <p className="text-black/70">
        Nội dung: <strong>{intent.description}</strong> · Mã: {orderCode} · Trạng thái:{' '}
        <strong data-testid="fake-status">{intent.status}</strong>
      </p>
      <form action={act} className="flex flex-col gap-2">
        <button
          name="mode"
          value="full"
          className="h-12 rounded-full border-2 border-brand-ink bg-brand font-extrabold text-brand-ink"
        >
          Giả lập đã trả đủ
        </button>
        <button
          name="mode"
          value="short"
          className="h-12 rounded-full border-2 border-brand-ink font-extrabold"
        >
          Giả lập trả thiếu 1.000đ
        </button>
        <button
          name="mode"
          value="lost"
          className="h-12 rounded-full border-2 border-brand-ink font-extrabold"
        >
          Giả lập trả nhưng mất webhook
        </button>
      </form>
    </section>
  );
}
