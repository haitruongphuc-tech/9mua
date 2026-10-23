import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatDateTimeVN, formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';
import { getBalance, listBalanceEntries } from '@/modules/payouts';

export const metadata: Metadata = { title: 'Số dư', robots: { index: false } };

const TYPE_LABELS: Record<string, string> = {
  order_credit: 'Tiền bán hàng',
  payout_reserve: 'Rút tiền',
  payout_reversal: 'Hoàn lại yêu cầu rút',
  adjustment: '9MUA điều chỉnh',
};

export default async function BalancePage() {
  const user = await requireUser();
  const kiot = await getKiotByOwner(user.id);
  if (!kiot) redirect('/kiot-cua-toi/tao');
  const [balance, entries] = await Promise.all([getBalance(kiot.id), listBalanceEntries(kiot.id)]);
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-extrabold">Số dư</h1>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border-2 border-brand-ink bg-brand/10 p-4">
          <p className="text-sm text-black/70">Có thể rút</p>
          <p className="text-2xl font-extrabold" data-testid="balance-available">
            {formatVnd(balance.available)}
          </p>
        </div>
        <div className="rounded-2xl border-2 border-black/10 p-4">
          <p className="text-sm text-black/70">Đang chờ (đơn chưa hoàn tất)</p>
          <p className="text-2xl font-extrabold" data-testid="balance-pending">
            {formatVnd(balance.pending)}
          </p>
        </div>
      </div>
      <p className="text-sm text-black/70">
        Tiền bán hàng được cộng khi đơn hoàn tất: người mua đã nhận hàng và hết 7 ngày khiếu nại. 9MUA trừ phí
        sàn trên tiền hàng (không tính phí ship).
      </p>
      <Link
        href="/kiot-cua-toi/so-du/rut"
        className="rounded-full border-2 border-brand-ink bg-brand py-3 text-center font-extrabold text-brand-ink"
      >
        Rút tiền
      </Link>
      <h2 className="font-extrabold">Lịch sử</h2>
      {entries.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70">Chưa có biến động.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10" data-testid="balance-entries">
          {entries.map((e) => (
            <li key={e.id} className="flex justify-between gap-3 py-3 text-sm">
              <span>
                <span className="block font-bold">
                  {TYPE_LABELS[e.type] ?? e.type}
                  {e.orderCode ? ` · ${e.orderCode}` : ''}
                </span>
                <span className="text-black/60">
                  {formatDateTimeVN(e.createdAt)}
                  {e.fee ? ` · phí sàn ${formatVnd(e.fee)}` : ''}
                  {e.type === 'adjustment' && e.note ? ` · ${e.note}` : ''}
                </span>
              </span>
              <span className={`font-extrabold ${e.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                {e.amount >= 0 ? '+' : '−'}
                {formatVnd(Math.abs(e.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
