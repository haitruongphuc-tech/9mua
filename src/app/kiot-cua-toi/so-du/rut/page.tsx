import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { getKiotByOwner, getPayoutAccount } from '@/modules/kiot';
import { getBalance, getKycStatus, listPayoutsForKiot, payoutQuote } from '@/modules/payouts';
import { PayoutRequestForm } from './PayoutRequestForm';

export const metadata: Metadata = { title: 'Rút tiền', robots: { index: false } };

const box = 'flex flex-col gap-2 rounded-2xl border-2 border-black/10 p-4';
const linkButton = 'self-start rounded-full border-2 border-brand-ink px-4 py-1.5 text-sm font-bold';

export default async function PayoutRequestPage() {
  const user = await requireUser();
  const kiot = await getKiotByOwner(user.id);
  if (!kiot) redirect('/kiot-cua-toi/tao');
  const [balance, account, kyc, payouts, quote] = await Promise.all([
    getBalance(kiot.id),
    getPayoutAccount(kiot.id),
    getKycStatus(user.id),
    listPayoutsForKiot(kiot.id, 5),
    payoutQuote(0),
  ]);
  const open = payouts.find((p) => p.status === 'pending' || p.status === 'processing');

  let blocker: React.ReactNode = null;
  if (kyc?.status !== 'approved') {
    blocker = (
      <div className={box} data-testid="payout-blocker">
        <p className="font-bold">
          {kyc?.status === 'pending'
            ? 'CCCD của bạn đang chờ 9MUA duyệt. Bạn rút được ngay khi được duyệt.'
            : 'Cần xác minh danh tính (CCCD) trước lần rút đầu tiên.'}
        </p>
        {kyc?.status !== 'pending' ? (
          <Link href="/kiot-cua-toi/xac-minh" className={linkButton}>
            Xác minh ngay
          </Link>
        ) : null}
      </div>
    );
  } else if (!account) {
    blocker = (
      <div className={box} data-testid="payout-blocker">
        <p className="font-bold">Bạn chưa khai báo tài khoản nhận tiền.</p>
        <Link href="/kiot-cua-toi/cai-dat#tai-khoan-nhan-tien" className={linkButton}>
          Khai báo tài khoản
        </Link>
      </div>
    );
  } else if (open) {
    blocker = (
      <div className={box} data-testid="payout-blocker">
        <p className="font-bold">
          Bạn đang có yêu cầu {open.code} ({formatVnd(open.amount)}) chờ xử lý.
        </p>
        <Link href="/kiot-cua-toi/so-du" className={linkButton}>
          Xem yêu cầu
        </Link>
      </div>
    );
  } else if (balance.available < quote.min) {
    blocker = (
      <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70" data-testid="payout-blocker">
        Số dư có thể rút ({formatVnd(balance.available)}) chưa đủ mức tối thiểu {formatVnd(quote.min)}.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-extrabold">Rút tiền</h1>
      <div className="rounded-2xl border-2 border-brand-ink bg-brand/10 p-4">
        <p className="text-sm text-black/70">Có thể rút</p>
        <p className="text-2xl font-extrabold">{formatVnd(balance.available)}</p>
      </div>
      {account ? (
        <p className="text-sm" data-testid="payout-destination">
          Chuyển vào: <b>{account.bankName}</b> · {account.accountNumber} · {account.accountName}
        </p>
      ) : null}
      {blocker ?? <PayoutRequestForm available={balance.available} fee={quote.fee} min={quote.min} />}
      <p className="text-sm text-black/70">
        9MUA không thu phí rút. Phí chi hộ của cổng thanh toán (nếu có) trừ vào số tiền nhận. Yêu cầu cần
        duyệt được xử lý trong 2 ngày làm việc.
      </p>
    </section>
  );
}
