import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { formatDateTimeVN, formatVnd } from '@/lib/format';
import { requireAdminVerified } from '@/modules/admin';
import { listMismatches } from '@/modules/payments';
import type { FlashParams } from '../flash';
import { resolveIssueAction } from './actions';

export const dynamic = 'force-dynamic';

const KIND: Record<string, string> = {
  mismatch: 'Chuyển sai số tiền',
  orphan: 'Tiền vào không khớp đơn nào',
  duplicate_payment: 'Trả 2 lần cho cùng 1 đơn',
};

export default async function MismatchQueuePage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const [issues, params] = await Promise.all([listMismatches(), searchParams]);
  return (
    <section className="flex flex-col gap-4 px-4 py-5">
      <h1 className="text-xl font-extrabold">Thanh toán lệch tiền</h1>
      <p className="text-sm text-black/70">
        Đối chiếu trên app MB / trang PayOS, hoàn lại hoặc xử lý với khách, rồi ghi lại cách đã làm.
      </p>
      <Flash ok={params.xong} error={params.loi} />
      {issues.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70">Không có giao dịch lệch.</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {issues.map((i) => (
          <li
            key={i.key}
            className="flex flex-col gap-2 rounded-2xl border-2 border-black/10 p-4"
            data-testid="issue-row"
          >
            <p className="font-extrabold">
              {KIND[i.kind] ?? i.kind} · mã {i.orderCode}
            </p>
            <p className="text-sm">
              Cần {i.expected !== null ? formatVnd(i.expected) : '—'} · nhận {formatVnd(i.received)} ·{' '}
              {formatDateTimeVN(i.at)}
            </p>
            <p className="text-sm text-black/70">
              {i.counterAccount ? `Người chuyển: ${i.counterAccount}` : 'Chưa rõ người chuyển'}
              {i.reference ? ` · mã GD ${i.reference}` : ''}
            </p>
            <form action={resolveIssueAction.bind(null, i.key)} className="flex gap-2">
              <input
                name="note"
                required
                minLength={5}
                placeholder="Đã xử lý thế nào?"
                className="h-11 min-w-0 flex-1 rounded-xl border-2 border-black/15 px-3"
              />
              <ConfirmSubmit confirm="Đánh dấu đã xử lý?">Đã xử lý</ConfirmSubmit>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
