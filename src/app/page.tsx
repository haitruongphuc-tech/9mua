import type { Metadata } from 'next';
import { StoriesRow } from '@/components/live/StoriesRow';
import { MarketShowcase } from '@/components/market/MarketShowcase';
import { VideoFeed } from '@/components/video/VideoFeed';
import { ClientMessages } from '@/i18n/ClientMessages';
import { readAnonId } from '@/lib/anon-id';
import { env } from '@/lib/env';
import { listStories, postFeed } from '@/modules/creator';
import { isFeatureOn } from '@/lib/features';
import { getCurrentUser } from '@/modules/identity';
import { getLiveForViewer, listLiveNow, type LiveView } from '@/modules/live';
import { loadFeed } from '@/server/feed';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { title: '9MUA - Kiếm tiền trên 9mua.com dễ và nhanh nhất', url: '/' },
};

// Trang chủ gộp mọi thứ người dùng đăng (SPEC-creator.md bổ sung 29/10): hàng người đang live + Story ở trên, feed dọc
// video có chèn buổi live đang phát. Web chưa có video và chưa có ai live thì hiện các khối Chợ để trang không trống.
export default async function HomePage() {
  const [user, anonId] = await Promise.all([getCurrentUser(), readAnonId()]);
  const viewer = { userId: user?.id, anonId };
  const [feed, stories, cards, posts] = await Promise.all([
    loadFeed(viewer),
    listStories(),
    listLiveNow(),
    // Bài viết ảnh + chữ chèn vào feed (SPEC-creator.md V5.10, công tắc posts).
    isFeatureOn('posts').then((on) => (on ? postFeed(viewer, null, 6).then((r) => r.items) : [])),
  ]);
  const lives = (await Promise.all(cards.map((c) => getLiveForViewer(c.id, viewer)))).filter(
    (v): v is Extract<LiveView, { kind: 'live' }> => v?.kind === 'live',
  );
  if (feed.items.length === 0 && lives.length === 0)
    return (
      <ClientMessages prefixes={['market.']}>
        <div className="mx-auto max-w-6xl px-4 py-6">
          <MarketShowcase variant="home" />
        </div>
      </ClientMessages>
    );
  return (
    <>
      {/* Chữ cho Google và trình đọc màn hình; người xem thấy ngay video. */}
      <div className="sr-only">
        <h1>9MUA - Kiếm tiền trên 9mua.com dễ và nhanh nhất</h1>
        <p>
          Xem video ngắn giới thiệu sản phẩm và mua ngay từ các Kiot trên Chợ 9MUA: nông sản, đặc sản, thời
          trang, mỹ phẩm, đồ gia dụng. Thuê Kiot online để bán hàng.
        </p>
      </div>
      <ClientMessages prefixes={['feed.', 'live.', 'shop.cart.']}>
        <VideoFeed
          variant="home"
          initial={feed.items}
          nextCursor={feed.nextCursor}
          appUrl={env().APP_URL}
          lives={lives}
          posts={posts}
          loggedIn={Boolean(user)}
          header={
            <StoriesRow
              compact
              groups={stories}
              lives={lives.map((l) => ({
                id: l.id,
                host: { displayName: l.host.displayName, avatarUrl: l.host.avatarUrl },
              }))}
            />
          }
        />
      </ClientMessages>
    </>
  );
}
