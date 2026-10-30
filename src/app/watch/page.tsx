import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/i18n/server';
import { readAnonId } from '@/lib/anon-id';
import { isFeatureOn } from '@/lib/features';
import { watchHome, type SeriesCard } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('feed.watch.title'), alternates: { canonical: '/watch' } };
}

// Watch (SPEC-creator.md V5.9 mục 3): Mới cập nhật, Xem nhiều 7 ngày, Phim đang theo dõi.
export default async function WatchPage() {
  if (!(await isFeatureOn('watch'))) notFound();
  const [t, user] = await Promise.all([getT(), getCurrentUser()]);
  const home = await watchHome({ userId: user?.id, anonId: await readAnonId() });
  const rows: { id: string; title: string; items: SeriesCard[] }[] = [
    { id: 'latest', title: t('feed.watch.latest'), items: home.latest },
    { id: 'popular', title: t('feed.watch.popular'), items: home.popular },
    ...(user ? [{ id: 'following', title: t('feed.watch.following'), items: home.following }] : []),
  ];
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-5 md:px-6">
      <h1 className="font-display text-[22px] font-bold">🎬 {t('feed.watch.title')}</h1>
      {rows.map((row) => (
        <section key={row.id} className="flex min-w-0 flex-col gap-2" data-testid={`watch-row-${row.id}`}>
          <h2 className="text-[15px] font-black">{row.title}</h2>
          {row.items.length === 0 ? (
            <p className="text-[12px] text-white/50">{t('feed.watch.empty')}</p>
          ) : (
            <ul className="flex gap-3 overflow-x-auto pb-2">
              {row.items.map((s) => (
                <li key={s.id} className="w-32 shrink-0">
                  <Link href={`/watch/${s.id}`} className="flex flex-col gap-1" data-testid="watch-card">
                    <span className="relative block aspect-[2/3] overflow-hidden rounded-[12px] bg-gradient-to-br from-brand/60 to-black">
                      {s.coverPath ? (
                        <Image
                          src={s.coverPath}
                          alt=""
                          fill
                          sizes="128px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center p-2 text-center text-[13px] font-black">
                          {s.title}
                        </span>
                      )}
                      <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold">
                        {t(s.status === 'complete' ? 'feed.watch.complete' : 'feed.watch.ongoing', {
                          count: s.episodeCount,
                        })}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-[12px] font-bold">{s.title}</span>
                    <span className="truncate text-[11px] text-white/50">@{s.ownerName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
