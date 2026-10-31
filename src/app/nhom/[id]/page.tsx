import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PostCard } from '@/components/post/PostCard';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { groupFeed, groupPage, myShareableVideos } from '@/modules/social';
import { joinGroupAction, leaveGroupAction, postToGroupAction, reportGroupAction } from '../actions';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ loi?: string; 'cho-duyet'?: string; 'da-bao-cao'?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const g = (await isFeatureOn('groups')) ? await groupPage(id, undefined) : null;
  return g && g.status === 'active'
    ? {
        title: g.name,
        alternates: { canonical: `/nhom/${id}` },
        ...(g.privacy === 'private' ? { robots: { index: false } } : {}),
      }
    : { robots: { index: false } };
}

const ERRORS = ['NOT_FOUND', 'FULL', 'BANNED', 'FORBIDDEN', 'POST_FAILED'] as const;
const REASONS = ['spam', 'scam', 'hate', 'other'] as const;

// Trang nhóm (SPEC-social.md V5.10): vào / rời nhóm, đăng bài hoặc video, bài trong nhóm, báo cáo. Nhóm riêng tư: người
// ngoài chỉ thấy tên, mô tả và nút xin vào.
export default async function GroupPage({ params, searchParams }: Props) {
  if (!(await isFeatureOn('groups'))) notFound();
  const { id } = await params;
  const [t, user, query] = await Promise.all([getT(), getCurrentUser(), searchParams]);
  const g = await groupPage(id, user?.id);
  if (!g) notFound();
  const locked = g.status !== 'active';
  const active = g.myStatus === 'active';
  const admin = active && (g.myRole === 'owner' || g.myRole === 'admin');
  const [feed, videos] = await Promise.all([
    locked ? null : groupFeed(id, user?.id),
    active && user && !locked ? myShareableVideos(user.id) : [],
  ]);
  const err = ERRORS.find((e) => e === query.loi);
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <div className="flex items-center gap-3">
        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[16px] bg-white/10">
          {g.avatarPath ? (
            <Image src={g.avatarPath} alt="" fill sizes="64px" className="object-cover" unoptimized />
          ) : null}
        </span>
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display text-[20px] font-bold" data-testid="group-name">
            {g.name}
          </h1>
          <p className="text-[12px] text-white/60" data-testid="group-meta">
            {t(g.privacy === 'private' ? 'feed.group.private' : 'feed.group.public')} ·{' '}
            {t('feed.group.memberCount', { count: g.memberCount })}
          </p>
        </div>
      </div>
      {g.description ? (
        <p className="whitespace-pre-line text-[14px] text-white/85">{g.description}</p>
      ) : null}
      {locked ? (
        <p
          className="rounded-[14px] bg-white/5 px-4 py-3 text-[13px] font-bold text-white/70"
          data-testid="group-locked"
        >
          {t('feed.group.locked')} {g.lockReason ?? ''}
        </p>
      ) : null}
      {err ? (
        <p role="alert" className="text-[13px] font-bold text-red-300">
          {t(`feed.group.err.${err}`)}
        </p>
      ) : null}
      {query['cho-duyet'] ? (
        <p role="status" className="text-[13px] font-bold text-green-300" data-testid="group-post-pending">
          {t('feed.group.postPending')}
        </p>
      ) : null}
      {query['da-bao-cao'] ? (
        <p role="status" className="text-[13px] font-bold text-green-300">
          {t('feed.event.reported')}
        </p>
      ) : null}

      {!locked && user ? (
        <div className="flex flex-wrap gap-2">
          {g.myStatus === null ? (
            <form action={joinGroupAction.bind(null, g.id)}>
              <button
                type="submit"
                className="h-10 rounded-full bg-brand px-5 text-[13px] font-black"
                data-testid="group-join"
              >
                {t(g.privacy === 'private' ? 'feed.group.ask' : 'feed.group.join')}
              </button>
            </form>
          ) : null}
          {g.myStatus === 'pending' ? (
            <form action={leaveGroupAction.bind(null, g.id)}>
              <button
                type="submit"
                className="h-10 rounded-full bg-white/10 px-5 text-[13px] font-black"
                data-testid="group-pending"
              >
                {t('feed.group.pending')}
              </button>
            </form>
          ) : null}
          {active && g.myRole !== 'owner' ? (
            <form action={leaveGroupAction.bind(null, g.id)}>
              <button
                type="submit"
                className="h-10 rounded-full bg-white/10 px-5 text-[13px] font-black"
                data-testid="group-leave"
              >
                {t('feed.group.leave')}
              </button>
            </form>
          ) : null}
          {admin ? (
            <Link
              href={`/nhom/${g.id}/quan-tri`}
              className="flex h-10 items-center rounded-full bg-white/10 px-5 text-[13px] font-black"
              data-testid="group-admin-link"
            >
              ⚙ {t('feed.group.manage')}
            </Link>
          ) : null}
        </div>
      ) : null}

      {active && !locked ? (
        <section className="flex flex-col gap-2 rounded-[16px] border border-white/10 bg-white/5 p-3">
          <form
            action={postToGroupAction.bind(null, g.id)}
            className="flex flex-col gap-2"
            data-testid="group-composer"
          >
            <textarea
              name="text"
              required
              maxLength={2000}
              rows={3}
              placeholder={t('feed.group.postHint')}
              className="rounded-[12px] border border-white/15 bg-black/30 p-3 text-[14px]"
            />
            <button
              type="submit"
              className="h-10 w-fit rounded-full bg-brand px-5 text-[13px] font-black"
              data-testid="group-post-submit"
            >
              {t('feed.group.post')}
            </button>
          </form>
          {videos.length ? (
            <form action={postToGroupAction.bind(null, g.id)} className="flex gap-2">
              <select
                name="videoId"
                required
                aria-label={t('feed.group.shareVideo')}
                className="h-10 min-w-0 flex-1 rounded-[12px] border border-white/15 bg-black/30 px-2 text-[13px]"
              >
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.caption.slice(0, 60) || v.id}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-10 shrink-0 rounded-full bg-white/10 px-4 text-[12px] font-black"
              >
                🎬 {t('feed.group.shareVideo')}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {feed === null && !locked ? (
        <p className="text-[13px] text-white/60" data-testid="group-members-only">
          🔒 {t('feed.group.membersOnly')}
        </p>
      ) : null}
      {feed ? (
        <ClientMessages prefixes={['feed.post.', 'feed.share', 'feed.reaction']}>
          <ul className="flex flex-col gap-3" data-testid="group-feed">
            {feed.length === 0 ? (
              <li className="text-[13px] text-white/50">{t('feed.group.noPosts')}</li>
            ) : null}
            {feed.map((item) => (
              <li key={item.id} className="flex flex-col gap-1">
                {item.post ? <PostCard post={item.post} loggedIn={Boolean(user)} /> : null}
                {item.video ? (
                  <Link
                    href={`/v/${item.video.id}`}
                    className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/5 p-2"
                  >
                    <span className="relative aspect-[9/16] w-20 shrink-0 overflow-hidden rounded-[10px] bg-black">
                      {item.video.posterUrl ? (
                        <Image
                          src={item.video.posterUrl}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </span>
                    <span className="flex min-w-0 flex-col text-[13px]">
                      <span className="font-bold">@{item.video.author.displayName}</span>
                      <span className="line-clamp-3 text-white/80">{item.video.caption}</span>
                    </span>
                  </Link>
                ) : null}
                {user ? (
                  <form action={reportGroupAction.bind(null, g.id, item.id)} className="flex justify-end">
                    <input type="hidden" name="reason" value="other" />
                    <button type="submit" className="text-[11px] text-white/40 hover:text-white/70">
                      ⚑ {t('feed.event.report')}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </ClientMessages>
      ) : null}

      {user && !locked && g.myRole !== 'owner' ? (
        <form
          action={reportGroupAction.bind(null, g.id, null)}
          className="flex items-center gap-2"
          data-testid="group-report"
        >
          <select
            name="reason"
            aria-label={t('feed.event.report')}
            className="h-9 rounded-[10px] border border-white/15 bg-white/5 px-2 text-[12px]"
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`feed.group.reason.${r}`)}
              </option>
            ))}
          </select>
          <button type="submit" className="h-9 rounded-full bg-white/10 px-4 text-[12px] font-bold">
            ⚑ {t('feed.group.reportGroup')}
          </button>
        </form>
      ) : null}
    </div>
  );
}
