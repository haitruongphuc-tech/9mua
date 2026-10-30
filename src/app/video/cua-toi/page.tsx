import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import { formatDateTime, formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { creatorStats, myVideoStats } from '@/modules/creator';
import { deleteVideoAction } from './actions';

export const metadata: Metadata = { title: 'Video của tôi', robots: { index: false } };

const STATUSES = ['processing', 'ready', 'failed', 'hidden', 'removed', 'expired'] as const;

export default async function MyVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ moi?: string; ngay?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const days = params.ngay === '30' ? 30 : 7;
  const [videos, stats, t] = await Promise.all([myVideoStats(user.id), creatorStats(user.id, days), getT()]);
  const tiles = [
    { id: 'views', label: t('post.stats.views'), value: stats.views.toLocaleString(t.lang) },
    { id: 'likes', label: t('post.stats.likes'), value: stats.likes.toLocaleString(t.lang) },
    { id: 'comments', label: t('post.stats.comments'), value: stats.comments.toLocaleString(t.lang) },
    { id: 'followers', label: t('post.stats.followers'), value: stats.newFollowers.toLocaleString(t.lang) },
    { id: 'orders', label: t('post.stats.orders'), value: stats.orders.toLocaleString(t.lang) },
    { id: 'revenue', label: t('post.stats.revenue'), value: formatVnd(stats.revenue) },
  ];
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[22px] font-black">{t('post.mine.title')}</h1>
        <Link
          href="/video/dang"
          className="inline-flex h-10 items-center rounded-full bg-brand px-4 text-[13px] font-black"
        >
          {t('post.mine.new')}
        </Link>
      </div>
      {/* Thống kê 7 / 30 ngày (SPEC-social.md bổ sung 30/10, A4): số thật; doanh số là tiền hàng của Kiot. */}
      <section
        className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/5 p-4"
        data-testid="creator-stats"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[16px] font-black">{t('post.stats.title')}</h2>
          <div className="flex gap-1 rounded-full bg-white/10 p-1 text-[12px] font-bold">
            {([7, 30] as const).map((d) => (
              <Link
                key={d}
                href={d === 7 ? '/video/cua-toi' : '/video/cua-toi?ngay=30'}
                aria-current={days === d ? 'page' : undefined}
                className={`rounded-full px-3 py-1 ${days === d ? 'bg-white text-ink' : 'text-white/70'}`}
              >
                {t('post.stats.range', { days: d })}
              </Link>
            ))}
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          {tiles.map((s) => (
            <div key={s.id} className="flex flex-col-reverse justify-end">
              <dt className="text-[11px] leading-tight text-white/50">{s.label}</dt>
              <dd className="truncate text-[17px] font-black" data-testid={`stat-${s.id}`}>
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-[11px] text-white/50">{t('post.stats.note')}</p>
      </section>
      {params.moi ? (
        <p
          role="status"
          className="rounded-[14px] bg-success/20 px-4 py-3 text-[13px] font-bold text-green-300"
        >
          {t('post.mine.uploaded')}
        </p>
      ) : null}
      {videos.length === 0 ? (
        <p className="rounded-[18px] border border-white/10 bg-white/5 p-6 text-center text-white/60">
          {t('post.mine.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="my-videos">
          {videos.map((v) => {
            const status = STATUSES.find((s) => s === v.status);
            return (
              <li
                key={v.id}
                className="flex gap-3 rounded-[18px] border border-white/10 bg-white/5 p-3"
                data-testid="my-video"
              >
                <span className="relative h-24 w-14 shrink-0 overflow-hidden rounded-[10px] bg-black">
                  {v.posterUrl ? (
                    <Image src={v.posterUrl} alt="" fill sizes="56px" className="object-cover" unoptimized />
                  ) : null}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1 text-[13px]">
                  <span
                    className="flex flex-wrap items-center gap-1.5 font-bold"
                    data-testid="my-video-status"
                  >
                    {v.kind === 'story' ? (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] text-white">Story</span>
                    ) : null}
                    {v.duetOfId ? (
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white">
                        Duet
                      </span>
                    ) : null}
                    {status ? t(`post.mine.status.${status}`) : v.status}
                    {v.kind === 'story' && v.status === 'ready' && v.expiresAt ? (
                      <span className="font-normal text-white/60">
                        {t('post.mine.expires', { date: formatDateTime(v.expiresAt, t.lang) })}
                      </span>
                    ) : null}
                  </span>
                  {v.failReason ? <span className="text-red-400">{v.failReason}</span> : null}
                  {v.moderationNote ? <span className="text-red-400">{v.moderationNote}</span> : null}
                  <span className="line-clamp-2 text-white/70">{v.caption || t('post.mine.noCaption')}</span>
                  <span className="text-[12px] text-white/50">
                    {t('post.mine.stats', {
                      date: formatDateTime(v.createdAt, t.lang),
                      views: v.views,
                      likes: v.likes,
                      orders: v.orders,
                    })}
                  </span>
                  <span className="text-[12px] text-white/50">
                    {t('post.mine.stats2', {
                      comments: v.comments,
                      saves: v.saves,
                      revenue: formatVnd(v.revenue),
                    })}
                  </span>
                  <div className="flex gap-4">
                    {v.status === 'ready' ? (
                      <Link href={`/v/${v.id}`} className="font-bold text-brand">
                        {t('post.mine.view')}
                      </Link>
                    ) : null}
                    {v.status !== 'processing' ? (
                      <form action={deleteVideoAction}>
                        <input type="hidden" name="videoId" value={v.id} />
                        <button
                          type="submit"
                          className="font-bold text-red-400 underline"
                          data-testid="delete-video"
                        >
                          {t('post.mine.delete')}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
