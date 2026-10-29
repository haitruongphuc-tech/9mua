import { MessageButton } from '@/components/inbox/MessageButton';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ProfileActions } from '@/components/profile/ProfileActions';
import { SocialLinks } from '@/components/profile/SocialLinks';
import { VideoGrid } from '@/components/video/VideoGrid';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { env } from '@/lib/env';
import { getCreatorProfile } from '@/modules/creator';
import { liveIdOfHost } from '@/modules/live';
import { getCurrentUser } from '@/modules/identity';
import { followStats, getSocialLinks } from '@/modules/social';

const load = cache(getCreatorProfile);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const p = await load((await params).userId);
  if (!p) return { title: 'Không tìm thấy creator', robots: { index: false } };
  return { title: `${p.displayName} – Creator`, description: `${p.videoCount} video trên 9MUA.` };
}

// Trang creator kiểu V4 (SPEC-creator.md mục 7, SPEC-social.md mục 1): số liệu thật, Follow, link mạng xã hội.
export default async function CreatorPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const p = await load(userId);
  if (!p) notFound();
  const viewer = await getCurrentUser();
  const [follow, links, t, liveId] = await Promise.all([
    followStats(p.id, viewer?.id),
    getSocialLinks(p.id),
    getT(),
    liveIdOfHost(p.id),
  ]);
  const isSelf = viewer?.id === p.id;
  const url = `${env().APP_URL}/creator/${p.id}`;
  return (
    <ClientMessages prefixes={['profile.', 'feed.share.']}>
      <div>
        <section className="mx-auto max-w-[900px] px-4 py-6">
          <header className="flex items-center gap-4">
            {/* Đang live: viền đỏ + nhãn LIVE, bấm vào là xem (SPEC-live.md mục 4). */}
            <a
              href={liveId ? `/live/${liveId}` : undefined}
              className="relative shrink-0"
              data-testid={liveId ? 'creator-live-badge' : undefined}
            >
              <span
                className={`grid h-20 w-20 place-items-center rounded-full border-4 bg-gradient-to-br from-brand to-[#c2410c] text-[30px] font-black shadow-[0_0_0_2px_rgb(255_107_0/0.5)] ${liveId ? 'border-red-500' : 'border-ink'}`}
              >
                {p.displayName.trim().charAt(0).toUpperCase()}
              </span>
              {liveId ? (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black">
                  {t('live.badge')}
                </span>
              ) : null}
            </a>
            <div className="min-w-0">
              <h1 className="font-display text-[22px] font-black leading-tight">{p.displayName}</h1>
              <p className="text-[13px] text-white/60">{t('profile.creator')}</p>
            </div>
          </header>
          <ProfileActions
            target={{ userId: p.id }}
            stats={[
              { id: 'followers', value: follow.followers },
              { id: 'following', value: follow.following },
              { id: 'videos', value: p.videoCount },
              { id: 'likes', value: p.totalLikes },
            ]}
            initial={{ following: follow.isFollowing }}
            isSelf={isSelf}
            selfLink={{ href: '/video/cua-toi', label: t('profile.myVideos') }}
            share={{
              url,
              title: p.displayName,
              heading: t('profile.shareProfile'),
              qrHint: t('profile.qrProfile'),
            }}
            loginHref={`/dang-nhap?next=${encodeURIComponent(`/creator/${p.id}`)}`}
          >
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isSelf ? null : (
                <MessageButton
                  toUserId={p.id}
                  loginHref={`/dang-nhap?next=${encodeURIComponent(`/creator/${p.id}`)}`}
                />
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
