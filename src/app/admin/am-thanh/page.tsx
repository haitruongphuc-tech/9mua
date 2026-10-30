import { ConfirmSubmit } from '@/components/admin/ConfirmSubmit';
import { Flash } from '@/components/admin/Flash';
import { requireAdminVerified } from '@/modules/admin';
import { adminSounds } from '@/modules/creator';
import type { FlashParams } from '../flash';
import { setSoundStatusAction } from './actions';

export const dynamic = 'force-dynamic';

// Thư viện âm thanh (SPEC-creator.md V5.6 mục 2): CEO tải nhạc lên (tên, nguồn, MP3/M4A ≤ 10MB, ≤ 5 phút), xem âm thanh
// gốc người dùng tạo, gỡ âm thanh vi phạm (video đã dùng vẫn phát).
export default async function SoundsAdminPage({ searchParams }: { searchParams: FlashParams }) {
  await requireAdminVerified();
  const [sounds, params] = await Promise.all([adminSounds(), searchParams]);
  const field = 'h-11 rounded-[12px] border border-white/15 bg-white/10 px-3 text-base text-white';
  return (
    <section className="flex flex-col gap-4 px-4 py-5">
      <h1 className="text-xl font-extrabold">Âm thanh</h1>
      <p className="text-sm text-white/70">
        Âm thanh gốc tự tạo từ video công khai cho phép dùng lại. Nhạc CEO tải lên đứng đầu danh sách chọn khi
        chưa có âm thanh thịnh hành. Chỉ tải nhạc 9MUA có quyền dùng.
      </p>
      <Flash ok={params.xong} error={params.loi} />
      <form
        action="/api/admin/am-thanh"
        method="post"
        encType="multipart/form-data"
        className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4"
        data-testid="sound-upload"
      >
        <h2 className="font-bold">Tải nhạc lên</h2>
        <input name="title" required maxLength={60} placeholder="Tên bài" className={field} />
        <input name="artist" maxLength={60} placeholder="Nguồn / nghệ sĩ" className={field} />
        <input name="file" type="file" required accept="audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a" />
        <button type="submit" className="h-11 rounded-full bg-brand font-black text-white">
          Tải lên
        </button>
      </form>
      <ul className="flex flex-col gap-2" data-testid="sound-admin-list">
        {sounds.map((s) => (
          <li
            key={s.id}
            className={`flex flex-col gap-2 rounded-2xl border p-3 ${s.status === 'removed' ? 'border-danger/40 bg-danger/5' : 'border-white/10 bg-white/5'}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">
                {s.kind === 'library' ? '🎵' : '🎤'} {s.title ?? `Âm thanh gốc – @${s.authorName ?? ''}`}
                {s.artist ? ` – ${s.artist}` : ''}
              </span>
              <span className="text-xs text-white/60">
                {Math.round(s.durationSec)}s · {s.uses} video ·{' '}
                {s.status === 'removed' ? 'đã gỡ' : 'đang dùng'}
              </span>
            </div>
            <audio controls preload="none" src={s.url} className="w-full" />
            <form
              action={setSoundStatusAction.bind(null, s.id, s.status === 'removed' ? 'active' : 'removed')}
              className="flex flex-wrap gap-2"
            >
              {s.status !== 'removed' ? (
                <input
                  name="reason"
                  maxLength={200}
                  placeholder="Lý do gỡ"
                  className={`${field} min-w-0 flex-1`}
                />
              ) : null}
              <ConfirmSubmit
                confirm={
                  s.status === 'removed' ? 'Mở lại âm thanh này?' : 'Gỡ âm thanh này? Video đã dùng vẫn phát.'
                }
                tone={s.status === 'removed' ? 'plain' : 'danger'}
                testId={`sound-toggle-${s.id}`}
              >
                {s.status === 'removed' ? 'Mở lại' : 'Gỡ'}
              </ConfirmSubmit>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
