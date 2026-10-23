import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { VietQrImage } from '@/components/admin/VietQrImage';
import { formatDateTimeVN, formatVnd } from '@/lib/format';
import { requireAdminVerified } from '@/modules/admin';
import { findBank } from '@/modules/kiot';
import { listPayoutQueue } from '@/modules/payouts';
import type { FlashParams } from '../flash';
import { approvePayoutAction, markPayoutPaidAction, rejectPayoutAction } from './actions';

export const dynamic = 'force-dynamic';
const input =
  'h-11 min-w-0 flex-1 rounded-xl border-2 border-black/15 px-3 outline-none focus:border-brand-ink';

export default async function PayoutQueuePage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const params = await searchParams;
  const status = params['trang-thai'] === 'processing' ? 'processing' : 'pending';
  const items = await listPayoutQueue(status);
  return (
    <section className="flex flex-col gap-4 px-4 py-5">
      <h1 className="text-xl font-extrabold">
        {status === 'pending' ? 'Rút tiền chờ duyệt' : 'Lệnh chi đang chuyển'}
      </h1>
      <Flash ok={params.xong} error={params.loi} />
      <nav className="flex gap-2 text-sm font-bold">
        <a href="/admin/rut-tien" className="rounded-full border-2 border-black/10 px-3 py-1.5">
          Chờ duyệt
        </a>
        <a
          href="/admin/rut-tien?trang-thai=processing"
          className="rounded-full border-2 border-black/10 px-3 py-1.5"
        >
          Đang chuyển
        </a>
      </nav>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70" data-testid="queue-empty">
          Không có yêu cầu nào.
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {items.map((p) => (
          <li
            key={p.id}
            className="flex flex-col gap-2 rounded-2xl border-2 border-black/10 p-4"
            data-testid="payout-row"
            data-code={p.code}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-extrabold">
                {p.code} · {p.kiotName}
              </span>
              <span className="text-lg font-extrabold text-brand-deep">{formatVnd(p.netAmount)}</span>
            </div>
            <p className="text-sm text-black/70">
              Rút {formatVnd(p.amount)}
              {p.fee ? ` (phí ${formatVnd(p.fee)})` : ''} · {formatDateTimeVN(p.createdAt)}
            </p>
            <p className="text-sm">
              {findBank(p.bankBin)?.shortName ?? p.bankBin} · <b>{p.accountNumber}</b> · {p.accountName}
              {p.kycName && p.kycName !== p.accountName ? (
                <span className="ml-1 font-bold text-danger">⚠ CCCD: {p.kycName}</span>
              ) : null}
            </p>
            {p.reasons.length ? (
              <p className="text-sm text-black/70">Không chi tự động vì: {p.reasons.join('; ')}</p>
            ) : null}
            {status === 'processing' ? (
              <p className="text-sm">
                PayOS: {p.payosState ?? 'đang gửi'}
                {p.dispatchedAt ? ` · gửi lúc ${formatDateTimeVN(p.dispatchedAt)}` : ''}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <form action={approvePayoutAction.bind(null, p.id)}>
                  <ConfirmSubmit
                    confirm={`Chi ${formatVnd(p.netAmount)} cho ${p.kiotName} qua PayOS?`}
                    testId="approve-payos"
                  >
                    Chi qua PayOS
                  </ConfirmSubmit>
                </form>
                <details className="rounded-xl bg-surface-muted p-3">
                  <summary className="cursor-pointer text-sm font-bold">Đã chuyển tay (QR VietQR)</summary>
                  <div className="mt-2 flex flex-col items-start gap-2">
                    <VietQrImage
                      bin={p.bankBin}
                      accountNumber={p.accountNumber}
                      amount={p.netAmount}
                      description={`9MUA RUT ${p.code}`}
                    />
                    <form action={markPayoutPaidAction.bind(null, p.id)} className="flex w-full gap-2">
                      <input name="bankRef" required placeholder="Mã giao dịch ngân hàng" className={input} />
                      <ConfirmSubmit confirm="Xác nhận đã chuyển khoản xong?" tone="plain">
                        Đã chuyển
                      </ConfirmSubmit>
                    </form>
                  </div>
                </details>
                <details className="rounded-xl bg-surface-muted p-3">
                  <summary className="cursor-pointer text-sm font-bold text-danger">Từ chối</summary>
                  <form action={rejectPayoutAction.bind(null, p.id)} className="mt-2 flex gap-2">
                    <input name="reason" required placeholder="Lý do (người bán sẽ thấy)" className={input} />
                    <ConfirmSubmit confirm="Từ chối và hoàn số dư cho người bán?" tone="danger">
                      Từ chối
                    </ConfirmSubmit>
                  </form>
                </details>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
