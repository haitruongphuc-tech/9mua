import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { readAnonId } from '@/lib/anon-id';
import { isFeatureOn } from '@/lib/features';
import { seriesPage } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';
import { WatchPlayer } from './WatchPlayer';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tap?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const page = (await isFeatureOn('watch')) ? await seriesPage(id, {}) : null;
  return page
    ? {
        title: page.series.title,
        description: page.series.description.slice(0, 160),
        alternates: { canonical: `/watch/${id}` },
      }
    : {};
}

// Trang phim (SPEC-creator.md V5.9 mục 4): tên, mô tả, trình phát, danh sách tập. ?tap=<videoId> mở đúng tập (thông báo).
export default async function SeriesWatchPage({ params, searchParams }: Props) {
  if (!(await isFeatureOn('watch'))) notFound();
  const [{ id }, { tap }] = await Promise.all([params, searchParams]);
  const [t, user] = await Promise.all([getT(), getCurrentUser()]);
  const page = await seriesPage(id, { userId: user?.id, anonId: await readAnonId() });
  if (!page) notFound();
  const start =
    tap && page.episodes.some((e) => e.videoId === tap) ? { videoId: tap, second: 0 } : page.resume;
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 px-4 py-5 md:px-6">
      <div>
        <h1 className="font-display text-[22px] font-bold" data-testid="series-title">
          {page.series.title}
        </h1>
        <p className="text-[12px] font-bold text-white/60">
          {t(`post.series.genre.${page.series.genre}`)} ·{' '}
          {t(page.series.status === 'complete' ? 'feed.watch.complete' : 'feed.watch.ongoing', {
            count: page.series.episodeCount,
          })}
        </p>
        {page.series.description ? (
          <p className="mt-2 whitespace-pre-line text-[13px] text-white/80">{page.series.description}</p>
        ) : null}
      </div>
      <ClientMessages prefixes={['feed.']}>
        <WatchPlayer
          seriesId={page.series.id}
          episodes={page.episodes.map((e) => ({
            videoId: e.videoId,
            episodeNo: e.episodeNo,
            durationSec: e.durationSec,
            watched: e.watched,
          }))}
          videos={page.videos}
          start={start}
          loggedIn={Boolean(user)}
          following={page.following}
        />
      </ClientMessages>
    </div>
  );
}
