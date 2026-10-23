import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { VideoGrid } from '@/components/video/VideoGrid';
import { getCreatorProfile } from '@/modules/creator';

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

export default async function CreatorPage({ params }: { params: Promise<{ userId: string }> }) {
  const p = await load((await params).userId);
  if (!p) notFound();
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-brand-ink bg-brand text-2xl font-extrabold text-brand-ink">
          {p.displayName.trim().charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-extrabold">{p.displayName}</h1>
          <p className="text-sm text-black/70" data-testid="creator-stats">
            {p.videoCount} video · {p.totalLikes.toLocaleString('vi-VN')} lượt thích
          </p>
        </div>
      </header>
      {p.videos.length === 0 ? (
        <p className="rounded-2xl bg-surface-muted p-6 text-center text-black/70">Chưa có video.</p>
      ) : (
        <VideoGrid videos={p.videos} />
      )}
    </section>
  );
}
