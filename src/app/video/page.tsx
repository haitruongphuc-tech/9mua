import type { Metadata } from 'next';
import { VideoFeed } from '@/components/video/VideoFeed';
import { ClientMessages } from '@/i18n/ClientMessages';
import { readAnonId } from '@/lib/anon-id';
import { env } from '@/lib/env';
import { getCurrentUser } from '@/modules/identity';
import { loadFeed } from '@/server/feed';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Video',
  description: 'Xem video ngắn giới thiệu sản phẩm và mua ngay trên 9MUA.',
  alternates: { canonical: '/video' },
};

export default async function VideoFeedPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const user = await getCurrentUser();
  const first = (await searchParams).v;
  const feed = await loadFeed({ userId: user?.id, anonId: await readAnonId() }, { first });
  return (
    <ClientMessages prefixes={['feed.']}>
      <VideoFeed initial={feed.items} nextCursor={feed.nextCursor} appUrl={env().APP_URL} />
    </ClientMessages>
  );
}
