import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { formatDateTimeVN } from '@/lib/format';
import { requireAdminVerified } from '@/modules/admin';
import { connectStats, listLivesForAdmin, suggestTurn } from '@/modules/live';
import type { FlashParams } from '../flash';
import { banLiveAction, stopLiveAction } from './actions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = {
  created: 'Đang chuẩn bị',
  live: 'Đang live',
  ended: 'Đã kết thúc',
  stopped: 'CEO đã dừng',
};
const input = 'h-10 min-w-0 flex-1 rounded-[12px] border border-white/15 bg-white/10 px-3 text-white';

// Trang CEO cho Live (SPEC-live.md mục 8): buổi đang mở lên đầu, số báo cáo, dừng ngay, cấm phát live.
export default async function AdminLivePage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const [lives, stats, params] = await Promise.all([listLivesForAdmin(), connectStats(), searchParams]);
  const open = lives.filter((l) => l.status === 'live' || l.status === 'created');
  const past = lives.filter((l) => l.status !== 'live' && l.status !== 'created');
  const row = (l: (typeof lives)[number]) => (
    <li
      key={l.id}
      className="flex flex-col gap-2 rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm"
    >
      <p className="font-bold">
        {l.title}{' '}
        <span className={l.status === 'live' ? 'text-red-400' : 'text-white/60'}>
          · {STATUS[l.status] ?? l.status}
        </span>
        {l.hiddenAt ? <span className="text-red-400"> · đã ẩn khỏi danh sách</span> : null}
      </p>
      <p className="text-white/70">
        {l.host?.displayName ?? l.hostUserId} · {l.host?.phone ?? '—'} · bắt đầu{' '}
        {l.startedAt ? formatDateTimeVN(l.startedAt) : '—'} · cao nhất {l.peakViewers} người xem · {l.hearts}{' '}
        tim · <span className={l.reports ? 'text-red-400' : ''}>{l.reports} báo cáo</span>
        {l.endReason ? ` · lý do kết thúc: ${l.endReason}` : ''}
      </p>
      {l.status === 'live' || l.status === 'created' ? (
        <div className="flex flex-col gap-2">
          <a href={`/live/${l.id}`} target="_blank" rel="noopener noreferrer" className="text-brand">
            Xem buổi live →
          </a>
          <form action={stopLiveAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="liveId" value={l.id} />
            <input name="reason" required minLength={3} placeholder="Lý do dừng" className={input} />
            <ConfirmSubmit confirm="Dừng ngay buổi live này?" tone="danger" testId="stop-live">
              Dừng ngay
            </ConfirmSubmit>
          </form>
        </div>
      ) : null}
      <form action={banLiveAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="userId" value={l.hostUserId} />
        <select name="days" defaultValue="7" className={`${input} max-w-[150px] flex-none`}>
          <option value="1">Cấm 1 ngày</option>
          <option value="7">Cấm 7 ngày</option>
          <option value="30">Cấm 30 ngày</option>
          <option value="forever">Cấm vĩnh viễn</option>
        </select>
        <input name="reason" required minLength={3} placeholder="Lý do cấm" className={input} />
        <ConfirmSubmit confirm="Cấm tài khoản này phát live?" tone="danger">
          Cấm live
        </ConfirmSubmit>
      </form>
    </li>
  );
  return (
    <section className="flex flex-col gap-5 px-4 py-5">
      <h1 className="text-xl font-extrabold">Live</h1>
      <Flash ok={params.xong} error={params.loi} />
      <p className="text-sm text-white/70">
        Giới hạn số buổi cùng lúc, số người xem và thời lượng chỉnh ở Cài đặt. Buổi bị 5 người báo cáo tự ẩn
        khỏi danh sách Live và có email báo.
      </p>
      <p className="text-sm text-white/70" data-testid="live-connect-stats">
        7 ngày qua: {stats.failed}/{stats.total} lượt xem không kết nối được hình
        {stats.total ? ` (${((stats.failed / stats.total) * 100).toFixed(1)}%)` : ''}.
        {suggestTurn(stats) ? (
          <span className="text-red-400">
            {' '}
            Vượt 5%: nên thêm máy chủ TURN để người xem sau mạng chặn vẫn xem được (nhắn Claude để làm).
          </span>
        ) : null}
      </p>
      <h2 className="text-lg font-extrabold">Đang mở ({open.length})</h2>
      {open.length ? (
        <ul className="flex flex-col gap-2" data-testid="lives-open">
          {open.map(row)}
        </ul>
      ) : (
        <p className="text-sm text-white/60">Không có buổi nào đang live.</p>
      )}
      <h2 className="text-lg font-extrabold">Gần đây</h2>
      <ul className="flex flex-col gap-2">{past.map(row)}</ul>
    </section>
  );
}
