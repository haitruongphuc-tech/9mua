import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { formatDateTime, formatVnd } from '@/lib/format';
import { requireUser } from '@/modules/identity';
import { creatorStats, myVideoStats, type MyVideo } from '@/modules/creator';
import { deleteVideoAction, pinProfileAction, postTimingAction } from './actions';

export const metadata: Metadata = { title: 'Video của tôi', robots: { index: false } };

const STATUSES = [
  'processing',
  'ready',
  'failed',
  'hidden',
  'removed',
  'expired',
  'draft',
  'scheduled',
] as const;
const ERRORS = ['NOT_FOUND', 'SCHEDULE_INVALID', 'PIN_LIMIT'] as const;

// Giờ Việt Nam cho ô datetime-local ("2026-11-01T09:30").
const vnInput = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 16);

export default async function MyVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ moi?: string; ngay?: string; tab?: string; loi?: string; sua?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const days = params.ngay === '30' ? 30 : 7;
  const [all, stats, t, postOptions, captionsOn, watchOn] = await Promise.all([
    myVideoStats(user.id),
    creatorStats(user.id, days),
    getT(),
    isFeatureOn('post_options'),
    isFeatureOn('auto_captions'),
    isFeatureOn('watch'),
  ]);
  // Tab Nháp (SPEC-creator.md V5.3): nháp đã xử lý xong hoặc đang xử lý. Video hẹn giờ nằm ở danh sách chính.
  const isDraft = (v: MyVideo) => v.status === 'draft' || (v.status === 'processing' && v.draft);
  const draftTab = postOptions && params.tab === 'nhap';
  const drafts = all.filter(isDraft);
  const videos = postOptions ? all.filter((v) => isDraft(v) === draftTab) : all;
  const back = draftTab ? '/video/cua-toi?tab=nhap' : '/video/cua-toi';
  const error = ERRORS.find((e) => e === params.loi);
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
      {postOptions ? (
        <nav className="flex gap-2 text-[13px] font-bold" data-testid="my-video-tabs">
          {[
            { href: '/video/cua-toi', on: !draftTab, label: t('post.mine.tabPosted') },
            {
              href: '/video/cua-toi?tab=nhap',
              on: draftTab,
              label: t('post.mine.tabDrafts', { count: drafts.length }),
            },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.on ? 'page' : undefined}
              className={`rounded-full px-4 py-2 ${tab.on ? 'bg-white text-ink' : 'bg-white/10 text-white/70'}`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : null}
      {watchOn ? (
        <Link
          href="/video/cua-toi/phim"
          className="flex h-11 items-center justify-between rounded-[14px] bg-white/5 px-4 text-[13px] font-bold"
          data-testid="my-series-link"
        >
          🎬 {t('post.series.mine')} <span aria-hidden>›</span>
        </Link>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-[14px] bg-red-500/15 px-4 py-3 text-[13px] font-bold text-red-300">
          {t(`post.mine.err.${error}`)}
        </p>
      ) : null}
      {params.sua ? (
        <p
          role="status"
          className="rounded-[14px] bg-success/20 px-4 py-3 text-[13px] font-bold text-green-300"
        >
          {t('post.mine.saved')}
        </p>
      ) : null}
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
          {t(draftTab ? 'post.mine.emptyDrafts' : 'post.mine.empty')}
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
                    {v.publishAt && (v.status === 'scheduled' || v.status === 'processing') ? (
                      <span className="font-normal text-white/60" data-testid="my-video-publish-at">
                        {t('post.mine.publishAt', { date: formatDateTime(v.publishAt, t.lang) })}
                      </span>
                    ) : null}
                    {v.profilePinned ? (
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white">
                        {t('post.mine.pinned')}
                      </span>
                    ) : null}
                    {v.edited ? <span className="font-normal text-white/50">{t('post.edited')}</span> : null}
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
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {v.status === 'ready' ? (
                      <Link href={`/v/${v.id}`} className="font-bold text-brand">
                        {t('post.mine.view')}
                      </Link>
                    ) : null}
                    {postOptions && v.kind === 'video' ? <PostTools v={v} back={back} t={t} /> : null}
                    {captionsOn && v.captionStatus ? (
                      <Link
                        href={`/video/cua-toi/${v.id}/phu-de`}
                        className="font-bold text-white underline"
                        data-testid="edit-captions"
                      >
                        {t('post.mine.captions')}
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

// Nút sửa, ghim, đăng nháp, hẹn giờ / đổi giờ / huỷ hẹn (SPEC-creator.md V5.3).
function PostTools({ v, back, t }: { v: MyVideo; back: string; t: Awaited<ReturnType<typeof getT>> }) {
  const editable = ['processing', 'draft', 'scheduled', 'ready', 'hidden'].includes(v.status);
  const unpublished =
    v.status === 'draft' ||
    v.status === 'scheduled' ||
    (v.status === 'processing' && (v.draft || v.publishAt));
  const btn = 'font-bold text-brand underline';
  return (
    <>
      {editable ? (
        <Link
          href={`/video/cua-toi/${v.id}/sua`}
          className="font-bold text-white underline"
          data-testid="edit-video"
        >
          {t('post.mine.edit')}
        </Link>
      ) : null}
      {v.status === 'ready' ? (
        <form action={pinProfileAction}>
          <input type="hidden" name="videoId" value={v.id} />
          <input type="hidden" name="on" value={v.profilePinned ? '0' : '1'} />
          <button type="submit" className={btn} data-testid="pin-profile">
            {t(v.profilePinned ? 'post.mine.unpin' : 'post.mine.pin')}
          </button>
        </form>
      ) : null}
      {unpublished ? (
        <>
          <form action={postTimingAction}>
            <input type="hidden" name="videoId" value={v.id} />
            <input type="hidden" name="mode" value="now" />
            <input type="hidden" name="back" value={back} />
            <button type="submit" className={btn} data-testid="publish-now">
              {t('post.mine.publishNow')}
            </button>
          </form>
          <form action={postTimingAction} className="flex items-center gap-2">
            <input type="hidden" name="videoId" value={v.id} />
            <input type="hidden" name="mode" value="schedule" />
            <input type="hidden" name="back" value={back} />
            <input
              type="datetime-local"
              name="at"
              required
              defaultValue={v.publishAt ? vnInput(v.publishAt) : undefined}
              aria-label={t('post.schedule')}
              className="h-9 rounded-[10px] border border-white/15 bg-white/10 px-2 text-[12px] text-white"
              data-testid="schedule-at"
            />
            <button type="submit" className={btn} data-testid="schedule-save">
              {t(v.publishAt ? 'post.mine.reschedule' : 'post.mine.scheduleBtn')}
            </button>
          </form>
          {v.publishAt ? (
            <form action={postTimingAction}>
              <input type="hidden" name="videoId" value={v.id} />
              <input type="hidden" name="mode" value="draft" />
              <input type="hidden" name="back" value={back} />
              <button
                type="submit"
                className="font-bold text-white/70 underline"
                data-testid="schedule-cancel"
              >
                {t('post.mine.cancelSchedule')}
              </button>
            </form>
          ) : null}
        </>
      ) : null}
    </>
  );
}
