import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { formatDateTime, formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { findBank, getKiotByOwner } from '@/modules/kiot';
import { getBalance, listBalanceEntries, listPayoutsForKiot } from '@/modules/payouts';
import { cancelPayoutAction } from './actions';

export const metadata: Metadata = { title: 'Số dư', robots: { index: false } };

const ENTRY_TYPES = ['order_credit', 'payout_reserve', 'payout_reversal', 'adjustment'] as const;
const PAYOUT_TONE = {
  pending: 'bg-brand/20 text-orange-300',
  processing: 'bg-brand/20 text-orange-300',
  paid: 'bg-success/20 text-green-300',
  failed: 'bg-danger/20 text-red-300',
  rejected: 'bg-danger/20 text-red-300',
  cancelled: 'bg-white/10 text-white/60',
} as const;
type PayoutStatus = keyof typeof PAYOUT_TONE;

export default async function BalancePage({
  searchParams,
}: {
  searchParams: Promise<{ 'da-gui'?: string; 'tu-dong'?: string }>;
}) {
  const user = await requireUser();
  const kiot = await getKiotByOwner(user.id);
  if (!kiot) redirect('/kiot-cua-toi/tao');
  const [balance, entries, payouts, params, t] = await Promise.all([
    getBalance(kiot.id),
    listBalanceEntries(kiot.id),
    listPayoutsForKiot(kiot.id, 20),
    searchParams,
    getT(),
  ]);
  const sent = params['da-gui'];
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-xl font-black">{t('seller.bal.title')}</h1>
      {sent ? (
        <p
          role="status"
          className="rounded-[14px] bg-success/20 px-4 py-3 text-[13px] font-bold text-green-300"
        >
          {t(params['tu-dong'] ? 'seller.bal.sentAuto' : 'seller.bal.sent', { code: sent })}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[18px] bg-gradient-to-r from-brand to-orange-500 p-4">
          <p className="text-[12px] opacity-90">{t('seller.bal.available')}</p>
          <p className="text-2xl font-black" data-testid="balance-available">
            {formatVnd(balance.available)}
          </p>
        </div>
        <div className="rounded-[18px] border border-white/10 bg-white/5 p-4">
          <p className="text-[12px] text-white/60">{t('seller.bal.pending')}</p>
          <p className="text-2xl font-black" data-testid="balance-pending">
            {formatVnd(balance.pending)}
          </p>
        </div>
      </div>
      <p className="text-[13px] text-white/60">{t('seller.bal.explain')}</p>
      <Link
        href="/kiot-cua-toi/so-du/rut"
        className="flex h-12 items-center justify-center rounded-full bg-brand font-black text-white"
      >
        {t('seller.bal.withdraw')}
      </Link>
      {payouts.length > 0 ? (
        <>
          <h2 className="font-black">{t('seller.bal.requests')}</h2>
          <ul className="flex flex-col gap-2" data-testid="payout-list">
            {payouts.map((p) => {
              const known = p.status in PAYOUT_TONE ? (p.status as PayoutStatus) : null;
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-1 rounded-[18px] border border-white/10 bg-white/5 p-3 text-[13px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">
                      {p.code} · {formatVnd(p.amount)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${known ? PAYOUT_TONE[known] : ''}`}
                    >
                      {known ? t(`seller.pst.${known}`) : p.status}
                    </span>
                  </div>
                  <span className="text-white/60">
                    {t('seller.bal.receive', {
                      date: formatDateTime(p.createdAt, t.lang),
                      net: formatVnd(p.netAmount),
                    })}
                    {p.fee ? ` ${t('seller.bal.fee', { fee: formatVnd(p.fee) })}` : ''} ·{' '}
                    {findBank(p.bankBin)?.shortName ?? p.bankBin} {p.accountNumber}
                  </span>
                  {p.rejectReason ? (
                    <span className="text-red-400">{t('seller.bal.reason', { reason: p.rejectReason })}</span>
                  ) : null}
                  {p.bankRef ? (
                    <span className="text-white/60">{t('seller.bal.bankRef', { ref: p.bankRef })}</span>
                  ) : null}
                  {p.status === 'pending' ? (
                    <form action={cancelPayoutAction}>
                      <input type="hidden" name="payoutId" value={p.id} />
                      <button
                        type="submit"
                        className="text-[13px] font-bold underline"
                        data-testid="cancel-payout"
                      >
                        {t('seller.bal.cancelRequest')}
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      <h2 className="font-black">{t('seller.bal.history')}</h2>
      {entries.length === 0 ? (
        <p className="rounded-[18px] border border-white/10 bg-white/5 p-6 text-center text-white/60">
          {t('seller.bal.noHistory')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-white/10" data-testid="balance-entries">
          {entries.map((e) => {
            const type = ENTRY_TYPES.find((x) => x === e.type);
            return (
              <li key={e.id} className="flex justify-between gap-3 py-3 text-[13px]">
                <span>
                  <span className="block font-bold">
                    {type ? t(`seller.bal.type.${type}`) : e.type}
                    {e.orderCode ? ` · ${e.orderCode}` : ''}
                  </span>
                  <span className="text-white/50">
                    {formatDateTime(e.createdAt, t.lang)}
                    {e.fee ? ` · ${t('seller.bal.platformFee', { fee: formatVnd(e.fee) })}` : ''}
                    {e.type === 'adjustment' && e.note ? ` · ${e.note}` : ''}
                  </span>
                </span>
                <span className={`font-black ${e.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {e.amount >= 0 ? '+' : '−'}
                  {formatVnd(Math.abs(e.amount))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
