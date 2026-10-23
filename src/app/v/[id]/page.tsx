import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { VideoFeed } from '@/components/video/VideoFeed';
import { readAnonId } from '@/lib/anon-id';
import { env } from '@/lib/env';
import { getFeed, getVideo } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';

export const dynamic = 'force-dynamic';

const loadVideo = cache((id: string) => getVideo(id, {}));

// Link chia sẻ 9mua.com/v/<id>: có thẻ Open Graph, mở ra đúng video trong feed (SPEC-creator.md mục 6).
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const v = await loadVideo((await params).id);
  if (!v) return { title: 'Video không còn', robots: { index: false } };
  const title = v.caption ? v.caption.slice(0, 70) : `Video của ${v.author.displayName}`;
  const url = `${env().APP_URL}/v/${v.id}`;
  return {
    title,
    description: v.caption || 'Xem video và mua ngay trên 9MUA.',
    alternates: { canonical: url },
    openGraph: {
      type: 'video.other',
      title,
      description: v.caption || 'Xem video và mua ngay trên 9MUA.',
      url,
      images: v.posterUrl
        ? [{ url: v.posterUrl, width: v.width ?? undefined, height: v.height ?? undefined }]
        : ['/og-default.png'],
      videos: [
        {
          url: `${env().APP_URL}${v.fileUrl}`,
          type: 'video/mp4',
          width: v.width ?? undefined,
          height: v.height ?? undefined,
        },
      ],
    },
  };
}

export default async function SharedVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await loadVideo(id))) notFound();
  const user = await getCurrentUser();
  const feed = await getFeed({ userId: user?.id, anonId: await readAnonId() }, undefined, { first: id });
  return <VideoFeed initial={feed.items} nextCursor={feed.nextCursor} appUrl={env().APP_URL} />;
}
