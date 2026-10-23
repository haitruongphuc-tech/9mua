import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { formatDateTimeVN, formatVnd } from '@/lib/format';
import { requireAdminVerified } from '@/modules/admin';
import { listDisputes } from '@/modules/orders';
import type { FlashParams } from '../flash';
import { resolveDisputeAction } from './actions';

export const dynamic = 'force-dynamic';
const input = 'h-11 min-w-0 flex-1 rounded-xl border-2 border-black/15 px-3';

export default async function DisputeQueuePage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const [orders, params] = await Promise.all([listDisputes(), searchParams]);
  return (
    <section className="flex flex-col gap-4 px-4 py-5">
      <h1 className="text-xl font-extrabold">Khiếu nại</h1>
      <Flash ok={params.xong} error={params.loi} />
      {orders.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70">Không có khiếu nại nào.</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {orders.map((o) => (
          <li
            key={o.id}
            className="flex flex-col gap-2 rounded-2xl border-2 border-black/10 p-4"
            data-testid="dispute-row"
          >
            <div className="flex justify-between gap-2">
              <span className="font-extrabold">
                {o.code} · {o.kiot.name}
              </span>
              <span className="font-extrabold">{formatVnd(o.total)}</span>
            </div>
            <p className="text-sm">{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</p>
            <blockquote className="rounded-xl bg-surface-muted p-3 text-sm">
              “{o.dispute?.message}”
            </blockquote>
            {Array.isArray(o.dispute?.images) && o.dispute.images.length ? (
              <div className="flex gap-2">
                {(o.dispute.images as string[]).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Ảnh khiếu nại" className="h-20 w-20 rounded-lg object-cover" />
                  </a>
                ))}
              </div>
            ) : null}
            <details>
              <summary className="cursor-pointer text-sm font-bold">Lịch sử đơn</summary>
              <ol className="mt-1 text-xs text-black/70">
                {o.events.map((e) => (
                  <li key={e.id}>
                    {formatDateTimeVN(e.createdAt)} — {e.action}
                    {e.reason ? `: ${e.reason}` : ''}
                  </li>
                ))}
              </ol>
            </details>
            <form action={resolveDisputeAction.bind(null, o.id, 'refund')} className="flex gap-2">
              <input
                name="reason"
                required
                minLength={5}
                placeholder="Lý do hoàn cho người mua"
                className={input}
              />
              <ConfirmSubmit confirm={`Hoàn ${formatVnd(o.total)} cho người mua?`} tone="danger">
                Hoàn người mua
              </ConfirmSubmit>
            </form>
            <form action={resolveDisputeAction.bind(null, o.id, 'release')} className="flex gap-2">
              <input
                name="reason"
                required
                minLength={5}
                placeholder="Lý do trả cho người bán"
                className={input}
              />
              <ConfirmSubmit confirm="Trả tiền cho người bán (đơn hoàn tất)?">Trả người bán</ConfirmSubmit>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
