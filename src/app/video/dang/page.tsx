import type { Metadata } from 'next';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { getVideo, MAX_VIDEOS_PER_DAY, videosToday } from '@/modules/creator';
import { requireUser } from '@/modules/identity';
import { VideoUploadForm } from './VideoUploadForm';
import { requireCommitment } from '@/server/commitment';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('post.title'), robots: { index: false } };
}

// Đăng video / Story 24 giờ / Duet (SPEC-creator.md mục 1 + bổ sung 27/10), giao diện V4.
export default async function UploadVideoPage({
  searchParams,
}: {
  searchParams: Promise<{ duet?: string; story?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  await requireCommitment(
    user.id,
    `/video/dang${params.story ? '?story=1' : params.duet ? `?duet=${params.duet}` : ''}`,
  );
  const [t, videos, stories, duet] = await Promise.all([
    getT(),
    videosToday(user.id),
    videosToday(user.id, 'story'),
    params.duet ? getVideo(params.duet, {}) : Promise.resolve(null),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-[22px] font-bold">{t('post.title')}</h1>
      <p className="text-[13px] text-white/60">{t('post.lead')}</p>
      <ClientMessages prefixes={['post.']}>
        <VideoUploadForm
          remaining={{
            video: Math.max(MAX_VIDEOS_PER_DAY - videos, 0),
            story: Math.max(MAX_VIDEOS_PER_DAY - stories, 0),
          }}
          initialMode={params.story ? 'story' : 'video'}
          duet={duet ? { id: duet.id, author: duet.author.displayName, posterUrl: duet.posterUrl } : null}
        />
      </ClientMessages>
    </div>
  );
}
