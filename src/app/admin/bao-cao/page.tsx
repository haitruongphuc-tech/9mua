import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { formatDateTimeVN } from '@/lib/format';
import { requireAdminVerified } from '@/modules/admin';
import { listFailedVideoJobs, listVideoReports, VIDEO_REPORT_REASONS } from '@/modules/creator';
import { listReports, REPORT_REASONS } from '@/modules/marketplace';
import type { FlashParams } from '../flash';
import { resolveProductAction, resolveVideoAction } from './actions';

export const dynamic = 'force-dynamic';
const input = 'h-11 min-w-0 flex-1 rounded-[14px] border border-white/15 bg-white/10 text-white px-3';
const label = (list: readonly { value: string; label: string }[], counts: Record<string, number>) =>
  Object.entries(counts)
    .map(([k, n]) => `${list.find((r) => r.value === k)?.label ?? k} (${n})`)
    .join(', ');

export default async function ReportsQueuePage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const [products, videos, failed, params] = await Promise.all([
    listReports(),
    listVideoReports(),
    listFailedVideoJobs(),
    searchParams,
  ]);
  return (
    <section className="flex flex-col gap-4 px-4 py-5">
      <h1 className="text-xl font-extrabold">Báo cáo vi phạm</h1>
      <Flash ok={params.xong} error={params.loi} />
      <h2 className="font-extrabold">Sản phẩm ({products.length})</h2>
      <ul className="flex flex-col gap-3">
        {products.map((p) => (
          <li
            key={p.productId}
            className="flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-4"
            data-testid="product-report-row"
          >
            <p className="font-extrabold">
              {p.productName} · {p.kiotName}
            </p>
            <p className="text-sm">
              {p.reporters} người báo: {label(REPORT_REASONS, p.reasons)}
              {p.hidden ? <span className="ml-1 font-bold text-red-400">· đang ẩn</span> : null}
            </p>
            {p.messages.length ? <p className="text-sm text-white/70">“{p.messages.join('” · “')}”</p> : null}
            <form action={resolveProductAction.bind(null, p.productId, 'remove')} className="flex gap-2">
              <input name="reason" required placeholder="Lý do gỡ" className={input} />
              <ConfirmSubmit confirm="Gỡ sản phẩm này khỏi 9MUA?" tone="danger">
                Gỡ
              </ConfirmSubmit>
            </form>
            <form action={resolveProductAction.bind(null, p.productId, 'dismiss')}>
              <ConfirmSubmit confirm="Bỏ qua báo cáo và hiện lại sản phẩm?" tone="plain">
                Bỏ qua (hiện lại)
              </ConfirmSubmit>
            </form>
          </li>
        ))}
      </ul>
      <h2 className="font-extrabold">Video ({videos.length})</h2>
      <ul className="flex flex-col gap-3">
        {videos.map((v) => (
          <li
            key={v.videoId}
            className="flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-4"
            data-testid="video-report-row"
          >
            <p className="font-extrabold">
              <a href={`/v/${v.videoId}`} className="underline">
                {v.caption || '(không chú thích)'}
              </a>{' '}
              · {v.status}
            </p>
            <p className="text-sm">
              {v.reporters} người báo: {label(VIDEO_REPORT_REASONS, v.reasons)}
            </p>
            <form action={resolveVideoAction.bind(null, v.videoId, 'remove')} className="flex gap-2">
              <input name="reason" required placeholder="Lý do gỡ (người đăng sẽ thấy)" className={input} />
              <ConfirmSubmit confirm="Gỡ video này?" tone="danger">
                Gỡ
              </ConfirmSubmit>
            </form>
            {v.status === 'hidden' ? (
              <form action={resolveVideoAction.bind(null, v.videoId, 'restore')}>
                <ConfirmSubmit confirm="Hiện lại video?" tone="plain">
                  Bỏ qua (hiện lại)
                </ConfirmSubmit>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      <h2 id="video-loi" className="font-extrabold">
        Video xử lý lỗi nhiều lần ({failed.length})
      </h2>
      <ul className="flex flex-col gap-2 text-sm">
        {failed.map((f) => (
          <li key={f.videoId} className="rounded-xl bg-white/5 p-3">
            {f.videoId} · {f.attempts} lần · {formatDateTimeVN(f.at)} — {f.error}
          </li>
        ))}
      </ul>
    </section>
  );
}
