import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { formatDateTimeVN } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { myVideoStats } from '@/modules/creator';

export const metadata: Metadata = { title: 'Video của tôi', robots: { index: false } };

const STATUS: Record<string, string> = {
  processing: 'Đang xử lý…',
  ready: 'Đã đăng',
  failed: 'Không đăng được',
  hidden: 'Tạm ẩn (chờ 9MUA xem)',
  removed: 'Bị gỡ',
};

export default async function MyVideosPage({ searchParams }: { searchParams: Promise<{ moi?: string }> }) {
  const user = await requireUser();
  const [videos, params] = await Promise.all([myVideoStats(user.id), searchParams]);
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Video của tôi</h1>
        <Link
          href="/video/dang"
          className="rounded-full border-2 border-brand-ink bg-brand px-4 py-2 font-extrabold text-brand-ink"
        >
          + Đăng video
        </Link>
      </div>
      {params.moi ? (
        <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success">
          Đã tải lên. Video đang được xử lý, thường xong trong 1 phút — bạn sẽ nhận thông báo.
        </p>
      ) : null}
      {videos.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70">Bạn chưa đăng video nào.</p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="my-videos">
          {videos.map((v) => (
            <li
              key={v.id}
              className="flex gap-3 rounded-2xl border-2 border-black/10 p-3"
              data-testid="my-video"
            >
              <span className="relative h-24 w-14 shrink-0 overflow-hidden rounded-lg bg-black/80">
                {v.posterUrl ? (
                  <Image src={v.posterUrl} alt="" fill sizes="56px" className="object-cover" unoptimized />
                ) : null}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                <span className="font-bold" data-testid="my-video-status">
                  {STATUS[v.status] ?? v.status}
                </span>
                {v.failReason ? <span className="text-danger">{v.failReason}</span> : null}
                {v.moderationNote ? <span className="text-danger">{v.moderationNote}</span> : null}
                <span className="line-clamp-2 text-black/70">{v.caption || '(không có chú thích)'}</span>
                <span className="text-black/60">
                  {formatDateTimeVN(v.createdAt)} · {v.views} lượt xem · {v.likes} thích · {v.orders} đơn từ
                  video
                </span>
                {v.status === 'ready' ? (
                  <Link href={`/v/${v.id}`} className="font-bold text-brand-deep">
                    Xem video →
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
