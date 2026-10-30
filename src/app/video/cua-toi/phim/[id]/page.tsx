import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { episodeCandidates, MAX_EPISODE, mySeries, SERIES_GENRES } from '@/modules/creator';
import { requireUser } from '@/modules/identity';
import { setEpisodeAction, updateSeriesAction } from '../actions';

export const dynamic = 'force-dynamic';

const ERRORS = ['INVALID', 'NOT_FOUND', 'EPISODE_INVALID', 'EPISODE_TAKEN'] as const;

// Sửa phim (SPEC-creator.md V5.9 mục 1–2): tên, mô tả, thể loại, trạng thái, ảnh bìa 2:3; gắn video thành tập 1–200.
export default async function EditSeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ loi?: string; xong?: string; moi?: string }>;
}) {
  const user = await requireUser();
  if (!(await isFeatureOn('watch'))) redirect('/video/cua-toi');
  const [{ id }, sp, t] = await Promise.all([params, searchParams, getT()]);
  const series = (await mySeries(user.id)).find((s) => s.id === id);
  if (!series) notFound();
  const videos = await episodeCandidates(user.id, id);
  const err = ERRORS.find((e) => e === sp.loi) ?? (sp.loi?.startsWith('COVER_') ? 'COVER' : null);
  const field =
    'rounded-[14px] border border-white/15 bg-white/10 px-3 text-[14px] text-white outline-none focus:border-brand';
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <Link href="/video/cua-toi/phim" className="text-[12px] font-bold text-white/60">
        ← {t('post.series.mine')}
      </Link>
      <div className="flex items-center justify-between gap-2">
        <h1 className="min-w-0 truncate font-display text-[20px] font-bold">{series.title}</h1>
        <Link
          href={`/watch/${series.id}`}
          className="shrink-0 text-[12px] font-bold text-brand"
          data-testid="series-open"
        >
          {t('post.series.view')} ↗
        </Link>
      </div>
      {err ? (
        <p role="alert" className="rounded-[14px] bg-red-500/15 px-4 py-3 text-[13px] font-bold text-red-300">
          {t(`post.series.err.${err}`)}
        </p>
      ) : sp.xong || sp.moi ? (
        <p
          role="status"
          className="rounded-[14px] bg-success/20 px-4 py-3 text-[13px] font-bold text-green-300"
        >
          {t('post.series.saved')}
        </p>
      ) : null}
      <form
        action={updateSeriesAction.bind(null, series.id)}
        className="flex flex-col gap-2"
        data-testid="series-edit"
      >
        <input name="title" required maxLength={80} defaultValue={series.title} className={`${field} h-11`} />
        <textarea
          name="description"
          maxLength={500}
          rows={3}
          defaultValue={series.description}
          className={`${field} py-2`}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            name="genre"
            defaultValue={series.genre}
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
            defaultValue={series.status}
            className={`${field} h-11`}
            aria-label={t('post.series.statusLabel')}
          >
            <option value="ongoing">{t('post.series.status.ongoing')}</option>
            <option value="complete">{t('post.series.status.complete')}</option>
          </select>
        </div>
        <button type="submit" className="h-11 rounded-full bg-white/10 font-black">
          {t('post.series.save')}
        </button>
      </form>
      <form
        action="/api/watch/cover"
        method="post"
        encType="multipart/form-data"
        className="flex items-center gap-3"
      >
        <span className="relative h-24 w-16 shrink-0 overflow-hidden rounded-[10px] bg-white/10">
          {series.coverPath ? (
            <Image src={series.coverPath} alt="" fill sizes="64px" className="object-cover" unoptimized />
          ) : null}
        </span>
        <input type="hidden" name="seriesId" value={series.id} />
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[12px] font-bold text-white/70">
          {t('post.series.cover')}
          <input
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,image/webp"
            className="min-w-0 text-[12px]"
          />
        </label>
        <button type="submit" className="h-10 shrink-0 rounded-full bg-white/10 px-4 text-[12px] font-black">
          {t('post.series.upload')}
        </button>
      </form>
      <section className="flex flex-col gap-2" data-testid="series-episodes">
        <h2 className="font-black">{t('post.series.episodes', { count: series.episodeCount })}</h2>
        <p className="text-[12px] text-white/50">{t('post.series.episodesHint', { max: MAX_EPISODE })}</p>
        {videos.length === 0 ? (
          <p className="text-[12px] text-white/50">{t('post.series.noVideos')}</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {videos.map((v) => (
            <li key={v.id} className="rounded-[14px] bg-white/5 p-2" data-testid="series-video">
              <form
                action={setEpisodeAction.bind(null, series.id, v.id)}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="relative h-14 w-9 shrink-0 overflow-hidden rounded-[6px] bg-black">
                  {v.posterUrl ? (
                    <Image src={v.posterUrl} alt="" fill sizes="36px" className="object-cover" unoptimized />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px]">{v.caption || '—'}</span>
                <input
                  name="episodeNo"
                  type="number"
                  min={1}
                  max={MAX_EPISODE}
                  defaultValue={v.episodeNo ?? undefined}
                  placeholder={t('post.series.episodeNo')}
                  aria-label={t('post.series.episodeNo')}
                  className={`${field} h-9 w-20`}
                  data-testid="series-episode-no"
                />
                <label className="flex items-center gap-1 text-[11px]">
                  <input
                    type="checkbox"
                    name="watchOnly"
                    defaultChecked={v.watchOnly}
                    className="accent-[#ff6b00]"
                  />
                  {t('post.series.watchOnly')}
                </label>
                <button
                  type="submit"
                  className="h-9 rounded-full bg-brand px-3 text-[12px] font-black text-white"
                  data-testid="series-episode-save"
                >
                  {v.seriesId ? t('post.series.update') : t('post.series.add')}
                </button>
                {v.seriesId ? (
                  <button
                    type="submit"
                    name="remove"
                    value="1"
                    className="h-9 rounded-full border border-white/20 px-3 text-[12px] font-bold"
                  >
                    {t('post.series.remove')}
                  </button>
                ) : null}
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
