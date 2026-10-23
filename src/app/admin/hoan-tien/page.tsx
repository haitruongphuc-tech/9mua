import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { VietQrImage } from '@/components/admin/VietQrImage';
import { formatDateTimeVN, formatVnd } from '@/lib/format';
import { requireAdminVerified } from '@/modules/admin';
import { findBank } from '@/modules/kiot';
import { listRefundsPending } from '@/modules/orders';
import type { FlashParams } from '../flash';
import { markRefundedAction } from './actions';

export const dynamic = 'force-dynamic';

type RefundAccount = { bankBin: string; accountNumber: string; accountName: string } | null;

export default async function RefundQueuePage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const [orders, params] = await Promise.all([listRefundsPending(), searchParams]);
  return (
    <section className="flex flex-col gap-4 px-4 py-5">
      <h1 className="text-xl font-extrabold">Đơn chờ hoàn tiền</h1>
      <Flash ok={params.xong} error={params.loi} />
      {orders.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70">Không có đơn nào.</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {orders.map((o) => {
          const acc = o.refundAccount as RefundAccount;
          return (
            <li
              key={o.id}
              className="flex flex-col gap-2 rounded-2xl border-2 border-black/10 p-4"
              data-testid="refund-row"
            >
              <div className="flex justify-between gap-2">
                <span className="font-extrabold">
                  {o.code} · {o.kiot.name}
                </span>
                <span className="text-lg font-extrabold text-brand-deep">{formatVnd(o.total)}</span>
              </div>
              <p className="text-sm text-black/70">Chờ hoàn từ {formatDateTimeVN(o.updatedAt)}</p>
              {acc ? (
                <>
                  <p className="text-sm">
                    Hoàn vào: {findBank(acc.bankBin)?.shortName ?? acc.bankBin} · <b>{acc.accountNumber}</b> ·{' '}
                    {acc.accountName}
                  </p>
                  <VietQrImage
                    bin={acc.bankBin}
                    accountNumber={acc.accountNumber}
                    amount={o.total}
                    description={`9MUA HOAN ${o.code}`}
                  />
                </>
              ) : (
                <p className="text-sm font-bold text-danger">Người mua chưa nhập tài khoản nhận hoàn tiền.</p>
              )}
              <form action={markRefundedAction.bind(null, o.id)} className="flex gap-2">
                <input
                  name="refundRef"
                  required
                  placeholder="Mã giao dịch ngân hàng"
                  className="h-11 min-w-0 flex-1 rounded-xl border-2 border-black/15 px-3"
                />
                <ConfirmSubmit confirm={`Xác nhận đã hoàn ${formatVnd(o.total)} cho đơn ${o.code}?`}>
                  Đã hoàn
                </ConfirmSubmit>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
