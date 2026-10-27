import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner, getPayoutAccount } from '@/modules/kiot';
import { getBalance, getKycStatus, listPayoutsForKiot, payoutQuote } from '@/modules/payouts';
import { PayoutRequestForm } from './PayoutRequestForm';

export const metadata: Metadata = { title: 'Rút tiền', robots: { index: false } };

const box = 'flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-4';
const linkButton = 'self-start rounded-full border border-white/25 px-4 py-1.5 text-[13px] font-bold';

export default async function PayoutRequestPage() {
  const user = await requireUser();
  const kiot = await getKiotByOwner(user.id);
  if (!kiot) redirect('/kiot-cua-toi/tao');
  const [balance, account, kyc, payouts, quote, t] = await Promise.all([
    getBalance(kiot.id),
    getPayoutAccount(kiot.id),
    getKycStatus(user.id),
    listPayoutsForKiot(kiot.id, 5),
    payoutQuote(0),
    getT(),
  ]);
  const open = payouts.find((p) => p.status === 'pending' || p.status === 'processing');

  let blocker: React.ReactNode = null;
  if (kyc?.status !== 'approved') {
    blocker = (
      <div className={box} data-testid="payout-blocker">
        <p className="font-bold">
          {t(kyc?.status === 'pending' ? 'seller.wd.kycPending' : 'seller.wd.kycNeeded')}
        </p>
        {kyc?.status !== 'pending' ? (
          <Link href="/kiot-cua-toi/xac-minh" className={linkButton}>
            {t('seller.wd.verifyNow')}
          </Link>
        ) : null}
      </div>
    );
  } else if (!account) {
    blocker = (
      <div className={box} data-testid="payout-blocker">
        <p className="font-bold">{t('seller.wd.noAccount')}</p>
        <Link href="/kiot-cua-toi/cai-dat#tai-khoan-nhan-tien" className={linkButton}>
          {t('seller.wd.declare')}
        </Link>
      </div>
    );
  } else if (open) {
    blocker = (
      <div className={box} data-testid="payout-blocker">
        <p className="font-bold">
          {t('seller.wd.open', { code: open.code, amount: formatVnd(open.amount) })}
        </p>
        <Link href="/kiot-cua-toi/so-du" className={linkButton}>
          {t('seller.wd.viewRequest')}
        </Link>
      </div>
    );
  } else if (balance.available < quote.min) {
    blocker = (
      <p
        className="rounded-[18px] border border-white/10 bg-white/5 p-6 text-center text-white/60"
        data-testid="payout-blocker"
      >
        {t('seller.wd.belowMin', { available: formatVnd(balance.available), min: formatVnd(quote.min) })}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-xl font-black">{t('seller.wd.title')}</h1>
      <div className="rounded-[18px] bg-gradient-to-r from-brand to-orange-500 p-4">
        <p className="text-[12px] opacity-90">{t('seller.bal.available')}</p>
        <p className="text-2xl font-black">{formatVnd(balance.available)}</p>
      </div>
      {account ? (
        <p className="text-[13px]" data-testid="payout-destination">
          {t('seller.wd.destination')} <b>{account.bankName}</b> · {account.accountNumber} ·{' '}
          {account.accountName}
        </p>
      ) : null}
      {blocker ?? <PayoutRequestForm available={balance.available} fee={quote.fee} min={quote.min} />}
      <p className="text-[13px] text-white/60">{t('seller.wd.note')}</p>
    </section>
  );
}
