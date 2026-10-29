import { Grid3x3, MapPin, Radio, ShoppingBag } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { MessageButton } from '@/components/inbox/MessageButton';
import { PreviewBanner } from '@/components/kiot/PreviewBanner';
import { HashtagText } from '@/components/profile/HashtagText';
import { KiotProductGrid } from '@/components/profile/KiotProductGrid';
import { ProfileActions } from '@/components/profile/ProfileActions';
import { SocialLinks } from '@/components/profile/SocialLinks';
import { VideoGrid } from '@/components/video/VideoGrid';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { env } from '@/lib/env';
import { getCurrentUser } from '@/modules/identity';
import { kiotOwnerId, listPublicProducts, provinceName } from '@/modules/kiot';
import { loadKiotPage } from '@/server/kiot-page';
import { kiotBasePath, kiotCanonical } from '../kiot-context';

const load = cache(async (slug: string) => loadKiotPage(slug, (await getCurrentUser())?.id ?? null));

const TABS = ['video', 'san-pham', 'live'] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) return { title: 'Kiot tạm ngưng', robots: { index: false } };
  const { kiot, preview } = found;
  const description = kiot.description || `Mua hàng tại ${kiot.name} trên 9MUA.`;
  return {
    title: kiot.name,
    description,
    alternates: { canonical: kiotCanonical(slug) },
    robots: preview ? { index: false } : undefined,
    openGraph: {
      title: kiot.name,
      description,
      url: kiotCanonical(slug),
      images: kiot.coverUrl ?? kiot.logoUrl ?? '/og-default.png',
    },
  };
}

// Trang Kiot kiểu V4 (SPEC-kiot.md bổ sung 27/10): bìa, avatar tròn viền đen, số liệu thật, Follow/Nhắn/Tim/Chia sẻ,
// 3 tab Video · Sản phẩm · Live (mặc định Sản phẩm).
export default async function KiotPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ trang?: string; tab?: string }>;
}) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { kiot, preview, owner, stats, viewer, socialLinks, videos, liveId } = data;
  const liveHref = liveId ? `${env().APP_URL}/live/${liveId}` : null;
  const query = await searchParams;
  const tab: Tab = TABS.includes(query.tab as Tab) ? (query.tab as Tab) : 'san-pham';
  const [products, base, t] = await Promise.all([
    tab === 'san-pham' ? listPublicProducts({ kiotId: kiot.id, limit: 60, cursor: query.trang }) : null,
    kiotBasePath(slug),
    getT(),
  ]);
  const home = base || '/';
  const tabHref = (id: Tab) => (id === 'san-pham' ? home : `${home}?tab=${id}`);
  const loginHref = `${env().APP_URL}/dang-nhap?next=${encodeURIComponent(`/k/${slug}`)}`;
  const ownerId = await kiotOwnerId(kiot.id);
  const icons = { video: Grid3x3, 'san-pham': ShoppingBag, live: Radio } as const;
  const tabLabel = {
    video: t('profile.tab.video'),
    'san-pham': t('profile.tab.products'),
    live: t('profile.tab.live'),
  };

  return (
    <ClientMessages prefixes={['profile.', 'feed.share.']}>
      <div>
        <div className="mx-auto max-w-[900px] pb-8">
          {preview ? (
            <div className="px-4 pt-3">
              <PreviewBanner />
            </div>
          ) : null}
          <div className="relative h-[170px] bg-gradient-to-br from-brand via-[#ff8a3d] to-[#7c2d12] md:h-[220px] md:rounded-b-[24px]">
            {kiot.coverUrl ? (
              <Image
                src={kiot.coverUrl}
                alt=""
                data-testid="kiot-cover"
                fill
                priority
                sizes="(max-width: 900px) 100vw, 900px"
                className="object-cover md:rounded-b-[24px]"
                unoptimized
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent md:rounded-b-[24px]" />
          </div>
          <div className="relative -mt-10 px-4">
            <div className="flex items-end gap-4">
              {/* Chủ Kiot đang live: viền đỏ + nhãn LIVE, bấm vào là xem (SPEC-live.md mục 4). */}
              <a
                href={liveHref ?? undefined}
                className="relative shrink-0"
                aria-label={liveHref ? t('live.badge') : undefined}
                data-testid={liveHref ? 'kiot-live-badge' : undefined}
              >
                <span
                  className={`relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 ${liveHref ? 'border-red-500' : 'border-ink'} bg-gradient-to-br from-brand to-[#c2410c] text-[36px] font-black`}
                >
                  {kiot.logoUrl ? (
                    <Image
                      src={kiot.logoUrl}
                      alt=""
                      data-testid="kiot-logo"
                      fill
                      sizes="96px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span aria-hidden data-testid="kiot-initial">
                      {kiot.name.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                {liveHref ? (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black">
                    {t('live.badge')}
                  </span>
                ) : null}
              </a>
              <div className="min-w-0 pb-1">
                <h1 className="font-display text-[22px] font-black leading-tight">{kiot.name}</h1>
                <p className="truncate text-[13px] text-white/60" data-testid="kiot-handle">
                  @{kiot.slug} • {owner.displayName}
                </p>
              </div>
            </div>
            <ProfileActions
              target={{ kiotId: kiot.id }}
              stats={[
                { id: 'followers', value: stats.followers },
                { id: 'hearts', value: stats.hearts },
                { id: 'products', value: stats.products },
                { id: 'sold', value: stats.sold },
              ]}
              initial={{ following: viewer.following, hearted: viewer.hearted }}
              isSelf={viewer.isOwner}
              selfLink={{ href: `${env().APP_URL}/kiot-cua-toi`, label: t('profile.manageKiot') }}
              phone={kiot.contactPhone}
              share={{
                url: kiotCanonical(slug),
                title: kiot.name,
                heading: t('profile.shareKiot'),
                qrHint: t('profile.qrKiot'),
              }}
              loginHref={loginHref}
            >
              {kiot.description ? <HashtagText text={kiot.description} className="mt-3 text-[13px]" /> : null}
              {kiot.province ? (
                <p
                  className="mt-1 flex items-center gap-1 text-[12px] text-white/50"
                  data-testid="kiot-location"
                >
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {[kiot.district, provinceName(kiot.province)].filter(Boolean).join(', ')}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {viewer.isOwner || !ownerId ? null : (
                  <MessageButton toUserId={ownerId} loginHref={loginHref} />
                )}
                <SocialLinks links={socialLinks} />
                {viewer.isOwner ? (
                  <Link
                    href={`${env().APP_URL}/ket-noi`}
                    className="rounded-full border border-dashed border-white/30 px-3 py-1.5 text-[12px] font-bold text-white/70"
                  >
                    {t('profile.addSocial')}
                  </Link>
                ) : null}
              </div>
            </ProfileActions>

            <nav className="mt-5 flex border-b border-white/10" aria-label={t('profile.tabs')}>
              {TABS.map((id) => {
                const Icon = icons[id];
                return (
                  <Link
                    key={id}
                    href={tabHref(id)}
                    scroll={false}
                    aria-current={tab === id ? 'page' : undefined}
                    className={`flex h-11 flex-1 items-center justify-center gap-1.5 border-b-2 text-[13px] font-bold ${
                      tab === id ? 'border-white text-white' : 'border-transparent text-white/50'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {tabLabel[id]}
                  </Link>
                );
              })}
            </nav>

            {tab === 'video' ? (
              <div className="mt-2">
                {videos.length === 0 ? (
                  <p className="py-10 text-center text-[13px] text-white/60">{t('profile.noVideos')}</p>
                ) : (
                  <VideoGrid videos={videos} />
                )}
              </div>
            ) : null}
            {tab === 'live' ? (
              <div className="py-10 text-center" data-testid="kiot-live-tab">
                <p className="text-[13px] text-white/60">
                  {liveHref ? t('live.publish.live') : t('profile.notLive', { name: owner.displayName })}
                </p>
                <Link
                  href={liveHref ?? `${env().APP_URL}/live`}
                  className="mt-3 inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-6 text-[13px] font-black"
                >
                  <Radio className="h-4 w-4" aria-hidden /> {t('profile.seeLive')}
                </Link>
              </div>
            ) : null}
            {products ? (
              <div className="mt-3">
                {products.items.length === 0 ? (
                  <p className="py-10 text-center text-[13px] text-white/60">{t('profile.noProducts')}</p>
                ) : (
                  <KiotProductGrid items={products.items} basePath={base} />
                )}
                {products.nextCursor ? (
                  <div className="mt-4 text-center">
                    <a
                      href={`${home}?trang=${products.nextCursor}`}
                      className="inline-flex h-10 items-center rounded-full border border-white/20 px-6 text-[13px] font-bold"
                    >
                      {t('profile.more')}
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </ClientMessages>
  );
}
