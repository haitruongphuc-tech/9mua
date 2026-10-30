import Image from 'next/image';
import Link from 'next/link';
import { MessageButton } from '@/components/inbox/MessageButton';
import { ProfileActions } from '@/components/profile/ProfileActions';
import { SocialLinks } from '@/components/profile/SocialLinks';
import { Avatar } from '@/components/ui/Avatar';
import { VideoGrid } from '@/components/video/VideoGrid';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { env } from '@/lib/env';
import type { CreatorProfile } from '@/modules/creator';
import { liveIdOfHost } from '@/modules/live';
import { getCurrentUser } from '@/modules/identity';
import { followStats, getSocialLinks } from '@/modules/social';

// Trang creator kiểu V4 (SPEC-creator.md mục 7, SPEC-social.md mục 1): số liệu thật, Follow, link mạng xã hội.
export async function CreatorProfileView({
  profile: p,
  handle,
}: {
  profile: CreatorProfile;
  handle: string | null;
}) {
  const viewer = await getCurrentUser();
  const [follow, links, t, liveId] = await Promise.all([
    followStats(p.id, viewer?.id),
    getSocialLinks(p.id),
    getT(),
    liveIdOfHost(p.id),
  ]);
  const isSelf = viewer?.id === p.id;
  // Có @tên thì link chia sẻ là 9mua.com/@<tên> (SPEC-identity.md V5.1).
  const path = handle ? `/@${handle}` : `/creator/${p.id}`;
  const url = `${env().APP_URL}${path}`;
  return (
    <ClientMessages prefixes={['profile.', 'feed.share.']}>
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
              <VideoGrid videos={p.videos} />
            )}
          </div>
        </section>
      </div>
    </ClientMessages>
  );
}
