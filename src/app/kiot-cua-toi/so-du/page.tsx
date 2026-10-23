import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatDateTimeVN, formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner } from '@/modules/kiot';
import { findBank } from '@/modules/kiot';
import { getBalance, listBalanceEntries, listPayoutsForKiot } from '@/modules/payouts';
import { cancelPayoutAction } from './actions';

export const metadata: Metadata = { title: 'Số dư', robots: { index: false } };

const TYPE_LABELS: Record<string, string> = {
  order_credit: 'Tiền bán hàng',
  payout_reserve: 'Rút tiền',
  payout_reversal: 'Hoàn lại yêu cầu rút',
  adjustment: '9MUA điều chỉnh',
};

const PAYOUT_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: 'Chờ 9MUA duyệt', tone: 'bg-brand/15 text-brand-deep' },
  processing: { label: 'Đang chuyển', tone: 'bg-brand/15 text-brand-deep' },
  paid: { label: 'Đã chuyển', tone: 'bg-success/10 text-success' },
  failed: { label: 'Chuyển lỗi — đã hoàn số dư', tone: 'bg-danger/10 text-danger' },
  rejected: { label: 'Bị từ chối — đã hoàn số dư', tone: 'bg-danger/10 text-danger' },
  cancelled: { label: 'Đã huỷ', tone: 'bg-black/5 text-black/60' },
};

export default async function BalancePage({
  searchParams,
}: {
  searchParams: Promise<{ 'da-gui'?: string }>;
}) {
  const user = await requireUser();
  const kiot = await getKiotByOwner(user.id);
  if (!kiot) redirect('/kiot-cua-toi/tao');
  const [balance, entries, payouts] = await Promise.all([
    getBalance(kiot.id),
    listBalanceEntries(kiot.id),
    listPayoutsForKiot(kiot.id, 20),
  ]);
  const sent = (await searchParams)['da-gui'];
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-extrabold">Số dư</h1>
      {sent ? (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success">
          Đã gửi yêu cầu rút {sent}. 9MUA sẽ chuyển tiền và báo qua email.
        </p>
      ) : null}
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
      {payouts.length > 0 ? (
        <>
          <h2 className="font-extrabold">Yêu cầu rút</h2>
          <ul className="flex flex-col gap-2" data-testid="payout-list">
            {payouts.map((p) => {
              const status = PAYOUT_STATUS[p.status] ?? { label: p.status, tone: '' };
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-1 rounded-2xl border-2 border-black/10 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">
                      {p.code} · {formatVnd(p.amount)}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.tone}`}>
                      {status.label}
                    </span>
                  </div>
                  <span className="text-black/60">
                    {formatDateTimeVN(p.createdAt)} · nhận {formatVnd(p.netAmount)}
                    {p.fee ? ` (phí ${formatVnd(p.fee)})` : ''} ·{' '}
                    {findBank(p.bankBin)?.shortName ?? p.bankBin} {p.accountNumber}
                  </span>
                  {p.rejectReason ? <span className="text-danger">Lý do: {p.rejectReason}</span> : null}
                  {p.bankRef ? <span className="text-black/60">Mã giao dịch: {p.bankRef}</span> : null}
                  {p.status === 'pending' ? (
                    <form action={cancelPayoutAction}>
                      <input type="hidden" name="payoutId" value={p.id} />
                      <button
                        type="submit"
                        className="text-sm font-bold underline"
                        data-testid="cancel-payout"
                      >
                        Huỷ yêu cầu
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
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
