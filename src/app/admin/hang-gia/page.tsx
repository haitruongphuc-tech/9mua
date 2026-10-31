import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { formatDateTime } from '@/lib/format';
import { isFeatureOn } from '@/lib/features';
import { requireAdminVerified } from '@/modules/admin';
import { listFakeReportQueue } from '@/modules/orders';
import type { FlashParams } from '../flash';
import { confirmFakeAction, rejectFakeAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hàng giả' };

const REASON = { fake: 'Hàng giả/nhái', wrong_origin: 'Sai nguồn gốc' } as const;

// Hàng chờ tố cáo hàng giả (SPEC-orders.md V5.2 mục 5): xếp theo hạn 24 giờ; quá hạn hiện đỏ.
export default async function AdminFakeReportsPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  await requireAdminVerified();
  const [queue, params, refundOn] = await Promise.all([
    listFakeReportQueue(),
    searchParams,
    isFeatureOn('fake_report_refund'),
  ]);
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-extrabold">Tố cáo hàng giả ({queue.length})</h1>
      <p className="text-sm text-white/60">
        Xác nhận hàng giả: gỡ sản phẩm, thu hồi huy hiệu nguồn gốc
        {refundOn
          ? ', hoàn tiền đơn gắn với tố cáo (trừ lại số dư người bán nếu đơn đã hoàn tất)'
          : ' (hoàn tiền đang tắt)'}
        .
      </p>
      <Flash ok={params.xong} error={params.loi} />
      <ul className="flex flex-col gap-3" data-testid="fake-queue">
        {queue.map((r) => (
          <li
            key={r.id}
            className={`flex flex-col gap-2 rounded-2xl border p-4 ${r.overdue ? 'border-danger bg-danger/10' : 'border-white/10 bg-white/5'}`}
          >
            <p className="font-bold">
              {r.product?.name ?? r.productId} · {r.product?.kiot.name}{' '}
              <span className={r.overdue ? 'text-red-300' : 'text-white/50'}>
                hạn {formatDateTime(r.deadlineAt, 'vi')}
                {r.overdue ? ' — QUÁ HẠN' : ''}
              </span>
            </p>
            <p className="text-sm">
              {REASON[r.reason as keyof typeof REASON] ?? r.reason}
              {r.orderId ? ' · có đơn' : ''}: {r.text}
            </p>
            <div className="flex flex-wrap gap-2">
              {r.images.map((url) => (
                <a key={url} href={url} target="_blank" rel="noopener" className="text-xs underline">
                  Ảnh
                </a>
              ))}
            </div>
            {r.sellerResponse ? (
              <p className="rounded-xl bg-white/5 p-2 text-sm">Kiot giải trình: {r.sellerResponse}</p>
            ) : null}
            <form action={confirmFakeAction.bind(null, r.id)} className="flex gap-2">
              <input
                name="reason"
                required
                maxLength={500}
                placeholder="Kết luận"
                className="h-11 min-w-0 flex-1 rounded-[14px] border border-white/15 bg-white/10 px-3 text-sm"
              />
              <ConfirmSubmit
                confirm="Xác nhận là hàng giả? Sản phẩm bị gỡ, huy hiệu nguồn gốc bị thu hồi."
                tone="danger"
              >
                Là hàng giả
              </ConfirmSubmit>
            </form>
            <form action={rejectFakeAction.bind(null, r.id)} className="flex gap-2">
              <input
                name="reason"
                required
                maxLength={500}
                placeholder="Lý do bác"
                className="h-11 min-w-0 flex-1 rounded-[14px] border border-white/15 bg-white/10 px-3 text-sm"
              />
              <ConfirmSubmit confirm="Bác tố cáo này?" tone="plain">
                Bác
              </ConfirmSubmit>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
