import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import { formatDateTime } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { myVideoStats } from '@/modules/creator';
import { deleteVideoAction } from './actions';

export const metadata: Metadata = { title: 'Video của tôi', robots: { index: false } };

const STATUSES = ['processing', 'ready', 'failed', 'hidden', 'removed', 'expired'] as const;

export default async function MyVideosPage({ searchParams }: { searchParams: Promise<{ moi?: string }> }) {
  const user = await requireUser();
  const [videos, params, t] = await Promise.all([myVideoStats(user.id), searchParams, getT()]);
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
