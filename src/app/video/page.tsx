import type { Metadata } from 'next';
import { VideoFeed } from '@/components/video/VideoFeed';
import { readAnonId } from '@/lib/anon-id';
import { env } from '@/lib/env';
import { getFeed } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Video',
  description: 'Xem video ngắn giới thiệu sản phẩm và mua ngay trên 9MUA.',
  alternates: { canonical: '/video' },
};

export default async function VideoFeedPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const user = await getCurrentUser();
  const first = (await searchParams).v;
  const feed = await getFeed({ userId: user?.id, anonId: await readAnonId() }, undefined, { first });
  return <VideoFeed initial={feed.items} nextCursor={feed.nextCursor} appUrl={env().APP_URL} />;
}
