import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { mySeries, SERIES_GENRES } from '@/modules/creator';
import { requireUser } from '@/modules/identity';
import { createSeriesAction } from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('post.series.mine'), robots: { index: false } };
}

// Phim của tôi (SPEC-creator.md V5.9 mục 1): danh sách phim và form tạo phim mới.
export default async function MySeriesPage({ searchParams }: { searchParams: Promise<{ loi?: string }> }) {
  const user = await requireUser();
  if (!(await isFeatureOn('watch'))) redirect('/video/cua-toi');
  const [t, list, { loi }] = await Promise.all([getT(), mySeries(user.id), searchParams]);
  const field =
    'rounded-[14px] border border-white/15 bg-white/10 px-3 text-[14px] text-white outline-none focus:border-brand';
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <Link href="/video/cua-toi" className="text-[12px] font-bold text-white/60">
        ← {t('post.mine.title')}
      </Link>
      <h1 className="font-display text-[22px] font-bold">🎬 {t('post.series.mine')}</h1>
      {loi ? (
        <p role="alert" className="rounded-[14px] bg-red-500/15 px-4 py-3 text-[13px] font-bold text-red-300">
          {t(loi === 'LIMIT' ? 'post.series.err.LIMIT' : 'post.series.err.INVALID')}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2" data-testid="my-series">
        {list.map((s) => (
          <li key={s.id}>
            <Link
              href={`/video/cua-toi/phim/${s.id}`}
              className="flex items-center gap-3 rounded-[14px] bg-white/5 p-2"
            >
              <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded-[8px] bg-white/10">
                {s.coverPath ? (
                  <Image src={s.coverPath} alt="" fill sizes="44px" className="object-cover" unoptimized />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-bold">{s.title}</span>
                <span className="text-[12px] text-white/50">
                  {t(s.status === 'complete' ? 'feed.watch.complete' : 'feed.watch.ongoing', {
                    count: s.episodeCount,
                  })}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <form
        action={createSeriesAction}
        className="flex flex-col gap-2 rounded-[16px] border border-white/10 p-3"
        data-testid="series-create"
      >
        <h2 className="font-black">{t('post.series.create')}</h2>
        <input
          name="title"
          required
          maxLength={80}
          placeholder={t('post.series.titleHint')}
          className={`${field} h-11`}
        />
        <textarea
          name="description"
          maxLength={500}
          rows={3}
          placeholder={t('post.series.descriptionHint')}
          className={`${field} py-2`}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            name="genre"
            defaultValue="khac"
            className={`${field} h-11`}
            aria-label={t('post.series.genreLabel')}
          >
            {SERIES_GENRES.map((g) => (
              <option key={g} value={g}>
                {t(`post.series.genre.${g}`)}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue="ongoing"
            className={`${field} h-11`}
            aria-label={t('post.series.statusLabel')}
          >
            <option value="ongoing">{t('post.series.status.ongoing')}</option>
            <option value="complete">{t('post.series.status.complete')}</option>
          </select>
        </div>
        <button type="submit" className="h-11 rounded-full bg-brand font-black text-white">
          {t('post.series.create')}
        </button>
      </form>
    </div>
  );
}
