import type { Metadata } from 'next';
import { MarketShowcase } from '@/components/market/MarketShowcase';
import { VideoFeed } from '@/components/video/VideoFeed';
import { ClientMessages } from '@/i18n/ClientMessages';
import { readAnonId } from '@/lib/anon-id';
import { env } from '@/lib/env';
import { getCurrentUser } from '@/modules/identity';
import { loadFeed } from '@/server/feed';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { title: '9MUA - Kiếm tiền trên 9mua.com dễ và nhanh nhất', url: '/' },
};

// Trang chủ là feed video dọc kiểu TikTok (CEO chọn 27/10/2026, docs/v4-merge-plan.md). Chưa có video nào thì
// hiện các khối Chợ như trang chủ cũ để trang không trống.
export default async function HomePage() {
  const user = await getCurrentUser();
  const feed = await loadFeed({ userId: user?.id, anonId: await readAnonId() });
  if (feed.items.length === 0)
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
      <ClientMessages prefixes={['feed.']}>
        <VideoFeed variant="home" initial={feed.items} nextCursor={feed.nextCursor} appUrl={env().APP_URL} />
      </ClientMessages>
    </>
  );
}
