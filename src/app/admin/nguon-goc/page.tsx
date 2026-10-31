import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { requireAdminVerified } from '@/modules/admin';
import { listApprovedOrigins, listOriginQueue } from '@/modules/kiot';
import type { FlashParams } from '../flash';
import { reviewOriginAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nguồn gốc' };

const KIND = {
  invoice: 'Hoá đơn',
  certificate: 'Giấy chứng nhận',
  photo: 'Ảnh hàng',
  video: 'Video',
} as const;

// Hàng chờ hồ sơ nguồn gốc (SPEC-kiot.md V5.2): xem file qua route có kiểm quyền, duyệt hoặc từ chối kèm lý do.
export default async function AdminOriginPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  await requireAdminVerified();
  const [queue, approved, params] = await Promise.all([
    listOriginQueue(),
    listApprovedOrigins(),
    searchParams,
  ]);
  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-xl font-extrabold">Hồ sơ nguồn gốc chờ duyệt ({queue.length})</h1>
      <Flash ok={params.xong} error={params.loi} />
      <ul className="flex flex-col gap-3" data-testid="origin-queue">
        {queue.map((d) => (
          <li key={d.id} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="font-bold">
              {d.kiot.name} <span className="text-white/50">@{d.kiot.slug}</span>
            </p>
            <ul className="flex flex-wrap gap-2 text-sm">
              {d.files.map((f) => (
                <li key={f.id}>
                  <a
                    href={`/api/admin/nguon-goc/${f.id}`}
                    target="_blank"
                    rel="noopener"
                    className="rounded-full bg-white/10 px-3 py-1 font-bold"
                  >
                    {KIND[f.kind as keyof typeof KIND] ?? f.kind} · {Math.ceil(f.bytes / 1024)} KB
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <form action={reviewOriginAction.bind(null, d.id, 'approve')}>
                <ConfirmSubmit confirm="Duyệt hồ sơ nguồn gốc này (hiệu lực 12 tháng)?">Duyệt</ConfirmSubmit>
              </form>
              <form action={reviewOriginAction.bind(null, d.id, 'reject')} className="flex gap-2">
                <input
                  name="reason"
                  required
                  maxLength={300}
                  placeholder="Lý do từ chối"
                  className="h-11 rounded-[14px] border border-white/15 bg-white/10 px-3 text-sm"
                />
                <ConfirmSubmit confirm="Từ chối hồ sơ?" tone="danger">
                  Từ chối
                </ConfirmSubmit>
              </form>
            </div>
          </li>
        ))}
      </ul>
      <h2 className="text-lg font-extrabold">Đang có hiệu lực ({approved.length})</h2>
      <ul className="flex flex-col gap-2" data-testid="origin-approved">
        {approved.map((d) => (
          <li
            key={d.id}
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3"
          >
            <span className="flex-1 font-bold">
              {d.kiot.name} <span className="text-white/50">@{d.kiot.slug}</span>
            </span>
            <form action={reviewOriginAction.bind(null, d.id, 'revoke')} className="flex gap-2">
              <input
                name="reason"
                required
                maxLength={300}
                placeholder="Lý do thu hồi"
                className="h-11 rounded-[14px] border border-white/15 bg-white/10 px-3 text-sm"
              />
              <ConfirmSubmit confirm="Thu hồi huy hiệu nguồn gốc?" tone="danger">
                Thu hồi
              </ConfirmSubmit>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
