import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { formatDateTimeVN } from '@/lib/format';
import { pinsOverview, requireAdminVerified } from '@/modules/admin';
import type { FlashParams } from '../flash';
import { pinKiotAction, pinVideoAction, unpinAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ghim' };

const field = 'h-11 rounded-[14px] border border-white/15 bg-white/10 text-white px-3 text-base';

// Ghim video lên đầu "Dành cho bạn" và Kiot lên đầu danh bạ / Kiot nổi bật (SPEC-admin.md bổ sung 27/10).
export default async function PinsPage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const [{ videos, kiots }, params] = await Promise.all([pinsOverview(), searchParams]);
  const list = (kind: 'video' | 'kiot', rows: { targetId: string; label: string; until: Date | null }[]) =>
    rows.length === 0 ? (
      <p className="text-sm text-white/60">Chưa ghim gì.</p>
    ) : (
      <ol className="flex flex-col gap-2" data-testid={`pins-${kind}`}>
        {rows.map((p, i) => (
          <li key={p.targetId} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm">
            <span className="font-extrabold">{i + 1}.</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{p.label}</span>
              <span className="text-white/60">
                {p.until ? `Hết ghim ${formatDateTimeVN(p.until)}` : 'Ghim không hạn'}
              </span>
            </span>
            <form action={unpinAction.bind(null, kind, p.targetId)}>
              <ConfirmSubmit confirm="Bỏ ghim?" tone="danger">
                Bỏ ghim
              </ConfirmSubmit>
            </form>
          </li>
        ))}
      </ol>
    );
  const addForm = (action: (f: FormData) => Promise<void>, name: string, label: string, hint: string) => (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_180px_auto] sm:items-end">
      <label className="flex flex-col gap-1 text-sm font-bold">
        {label}
        <input name={name} required className={field} placeholder={hint} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-bold">
        Hết ghim (tuỳ chọn)
        <input name="until" type="date" className={field} />
      </label>
      <ConfirmSubmit confirm="Ghim lên đầu?">Ghim</ConfirmSubmit>
    </form>
  );
  return (
    <section className="flex flex-col gap-5 px-4 py-5">
      <h1 className="text-xl font-extrabold">Ghim lên đầu (tối đa 5 mỗi loại)</h1>
      <Flash ok={params.xong} error={params.loi} />
      <div className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-extrabold">Video đầu “Dành cho bạn”</h2>
        {list('video', videos)}
        {addForm(pinVideoAction, 'video', 'Mã video hoặc link 9mua.com/v/…', 'vd. https://9mua.com/v/abc123')}
      </div>
      <div className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-extrabold">Kiot đầu danh bạ và “Kiot nổi bật”</h2>
        {list('kiot', kiots)}
        {addForm(pinKiotAction, 'kiot', 'Tên miền Kiot', 'vd. matong hoặc matong.9mua.com')}
      </div>
    </section>
  );
}
