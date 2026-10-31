import Image from 'next/image';
import Link from 'next/link';
import { MessageButton } from '@/components/inbox/MessageButton';
import { ProfileActions } from '@/components/profile/ProfileActions';
import { SocialLinks } from '@/components/profile/SocialLinks';
import { Avatar } from '@/components/ui/Avatar';
import { VideoGrid } from '@/components/video/VideoGrid';
import { PostCard } from '@/components/post/PostCard';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { isBlockedEither } from '@/lib/blocks';
import { env } from '@/lib/env';
import { isFeatureOn } from '@/lib/features';
import { BlockButton } from '@/components/social/BlockButton';
import { postsByAuthor, type CreatorProfile } from '@/modules/creator';
import { liveIdOfHost } from '@/modules/live';
import { getCurrentUser } from '@/modules/identity';
import {
  followStats,
  followSuggestions,
  getSocialLinks,
  likedTabPublic,
  likedVideos,
  listBlockedUsers,
  mutualFollowers,
} from '@/modules/social';
import { SuggestRow } from '@/components/profile/SuggestRow';

// Trang creator kiểu V4 (SPEC-creator.md mục 7, SPEC-social.md mục 1): số liệu thật, Follow, link mạng xã hội.
export async function CreatorProfileView({
  profile: p,
  handle,
}: {
  profile: CreatorProfile;
  handle: string | null;
}) {
  const viewer = await getCurrentUser();
  // Chặn nhau (SPEC-social.md V5.3): chỉ hiện "Không xem được trang này"; người chặn được bỏ chặn ngay tại đây.
  if (viewer && (await isBlockedEither(viewer.id, p.id))) {
    const t = await getT();
    const iBlocked = (await listBlockedUsers(viewer.id)).some((u) => u.id === p.id);
    return (
      <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <p className="text-[15px] font-bold" data-testid="profile-blocked">
          {t('common.block.hidden')}
        </p>
        {iBlocked ? (
          <BlockButton
            userId={p.id}
            name={p.displayName}
            unblock
            className="h-10 rounded-full bg-white/10 px-5 text-[13px] font-black"
          />
        ) : null}
      </section>
    );
  }
  const [follow, links, t, liveId, canBlock] = await Promise.all([
    followStats(p.id, viewer?.id),
    getSocialLinks(p.id),
    getT(),
    liveIdOfHost(p.id),
    isFeatureOn('social_more'),
  ]);
  const isSelf = viewer?.id === p.id;
  // Bạn chung, gợi ý follow, tab Đã thích (SPEC-social.md V5.1–V5.2), công tắc social_more.
  const socialMore = await isFeatureOn('social_more');
  const mutual = socialMore && viewer && !isSelf ? await mutualFollowers(viewer.id, p.id) : null;
  const suggestions =
    socialMore && viewer ? (await followSuggestions(viewer.id)).filter((x) => x.id !== p.id) : [];
  const liked = socialMore ? await likedVideos(p.id, viewer?.id) : null;
  const likedPublic = isSelf && liked ? await likedTabPublic(p.id) : false;
  // Tab "Bài viết" (SPEC-creator.md V5.10 mục 2), công tắc posts.
  const posts = (await isFeatureOn('posts')) ? await postsByAuthor(p.id, { userId: viewer?.id }) : [];
  // Có @tên thì link chia sẻ là 9mua.com/@<tên> (SPEC-identity.md V5.1).
  const path = handle ? `/@${handle}` : `/creator/${p.id}`;
  const url = `${env().APP_URL}${path}`;
  return (
    <ClientMessages prefixes={['profile.', 'feed.share', 'feed.post.']}>
      <div>
        {/* Ảnh bìa 3:1 (SPEC-social.md bổ sung 30/10, A2); chưa có thì nền màu. */}
        <div className="relative mx-auto aspect-[3/1] max-h-[300px] w-full max-w-[900px] overflow-hidden bg-gradient-to-br from-brand/50 via-[#7c2d12] to-ink md:rounded-b-[18px]">
          {p.coverUrl ? (
            <Image
              src={p.coverUrl}
              alt=""
              fill
              sizes="(max-width: 900px) 100vw, 900px"
              className="object-cover"
              priority
              unoptimized
              data-testid="creator-cover"
            />
          ) : null}
        </div>
        <section className="mx-auto max-w-[900px] px-4 pb-6">
          <header className="-mt-10 flex items-end gap-4">
            {/* Đang live: viền đỏ + nhãn LIVE, bấm vào là xem (SPEC-live.md mục 4). */}
            <a
              href={liveId ? `/live/${liveId}` : undefined}
              className="relative shrink-0"
              data-testid={liveId ? 'creator-live-badge' : undefined}
            >
              <span
                className={`block rounded-full border-4 shadow-[0_0_0_2px_rgb(255_107_0/0.5)] ${liveId ? 'border-red-500' : 'border-ink'}`}
                data-testid="creator-avatar"
                data-url={p.avatarUrl ?? ''}
              >
                <Avatar name={p.displayName} url={p.avatarUrl} className="h-20 w-20 text-[30px]" />
              </span>
              {liveId ? (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black">
                  {t('live.badge')}
                </span>
              ) : null}
            </a>
            <div className="min-w-0 pb-1">
              <h1 className="font-display text-[22px] font-black leading-tight">{p.displayName}</h1>
              <p className="text-[13px] text-white/60" data-testid="creator-handle">
                {handle ? `@${handle}` : t('profile.creator')}
              </p>
            </div>
          </header>
          {p.bio ? (
            <p className="mt-3 whitespace-pre-line text-[14px] text-white/85" data-testid="creator-bio">
              {p.bio}
            </p>
          ) : null}
          {mutual && mutual.total > 0 ? (
            <Link
              href={`/creator/${p.id}/theo-doi?ban-chung=1`}
              className="mt-3 flex items-center gap-2 text-[12px] text-white/70"
              data-testid="mutual-followers"
            >
              <span className="flex -space-x-2">
                {mutual.people.map((m) => (
                  <Avatar
                    key={m.id}
                    name={m.displayName}
                    url={m.avatarUrl}
                    className="h-6 w-6 border border-ink text-[10px]"
                  />
                ))}
              </span>
              <span>
                {mutual.total > 2
                  ? t('profile.mutual.many', {
                      names: mutual.people
                        .slice(0, 2)
                        .map((m) => m.displayName)
                        .join(', '),
                      others: mutual.total - 2,
                    })
                  : t('profile.mutual.few', { names: mutual.people.map((m) => m.displayName).join(', ') })}
              </span>
            </Link>
          ) : null}
          <ProfileActions
            target={{ userId: p.id }}
            stats={[
              { id: 'followers', value: follow.followers, href: `/creator/${p.id}/theo-doi` },
              { id: 'following', value: follow.following, href: `/creator/${p.id}/theo-doi?dang=1` },
              { id: 'videos', value: p.videoCount },
              { id: 'likes', value: p.totalLikes },
            ]}
            initial={{ following: follow.isFollowing }}
            isSelf={isSelf}
            selfLink={{ href: '/tai-khoan/ho-so', label: t('profile.edit.button') }}
            share={{
              url,
              title: p.displayName,
              heading: t('profile.shareProfile'),
              qrHint: t('profile.qrProfile'),
            }}
            loginHref={`/dang-nhap?next=${encodeURIComponent(path)}`}
          >
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isSelf ? null : (
                <MessageButton toUserId={p.id} loginHref={`/dang-nhap?next=${encodeURIComponent(path)}`} />
              )}
              <SocialLinks links={links} />
              {!isSelf && viewer && canBlock ? (
                <BlockButton
                  userId={p.id}
                  name={p.displayName}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] font-bold text-white/70"
                />
              ) : null}
              {isSelf ? (
                <Link
                  href="/ket-noi"
                  className="rounded-full border border-dashed border-white/30 px-3 py-1.5 text-[12px] font-bold text-white/70"
                >
                  {t('profile.addSocial')}
                </Link>
              ) : null}
            </div>
          </ProfileActions>
          <h2 className="mt-6 border-b border-white/10 pb-2 text-[13px] font-bold">
            {t('profile.tab.video')}
          </h2>
          <div className="mt-2">
            {p.videos.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-white/60">{t('profile.noCreatorVideos')}</p>
            ) : (
              <VideoGrid
                videos={p.videos}
                pinnedLabel={(await isFeatureOn('post_options')) ? t('profile.pinned') : undefined}
              />
            )}
          </div>
          {suggestions.length ? (
            <div className="mt-6">
              <SuggestRow people={suggestions} />
            </div>
          ) : null}
          {liked ? (
            <>
              <h2
                className="mt-6 border-b border-white/10 pb-2 text-[13px] font-bold"
                data-testid="profile-liked"
              >
                ♥ {t('profile.tab.liked')}
                {isSelf ? (
                  <span className="ml-2 text-[11px] font-normal text-white/50">
                    {t(likedPublic ? 'profile.liked.public' : 'profile.liked.private')}
                  </span>
                ) : null}
              </h2>
              <div className="mt-2">
                {liked.length ? (
                  <VideoGrid
                    showAuthor
                    videos={liked.map((v) => ({
                      id: v.id,
                      posterUrl: v.posterUrl,
                      caption: v.caption,
                      views: v.views,
                      likes: v.likes,
                      authorName: v.author.displayName,
                    }))}
                  />
                ) : (
                  <p className="py-6 text-center text-[13px] text-white/50">{t('profile.liked.empty')}</p>
                )}
              </div>
            </>
          ) : null}
          {posts.length ? (
            <>
              <h2
                className="mt-6 border-b border-white/10 pb-2 text-[13px] font-bold"
                data-testid="profile-posts"
              >
                {t('feed.post.section', { count: posts.length })}
              </h2>
              <div className="mt-2 flex flex-col gap-3">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} loggedIn={Boolean(viewer)} />
                ))}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </ClientMessages>
  );
}
