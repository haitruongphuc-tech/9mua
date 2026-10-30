import type { Metadata } from 'next';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import {
  getVideo,
  MAX_VIDEOS_PER_DAY,
  mySeries,
  selectableSound,
  videoLimits,
  videosToday,
} from '@/modules/creator';
import { getKiotByOwner, PROVINCES } from '@/modules/kiot';
import { requireUser } from '@/modules/identity';
import { isFeatureOn } from '@/lib/features';
import { VideoUploadForm } from './VideoUploadForm';
import { requireCommitment } from '@/server/commitment';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('post.title'), robots: { index: false } };
}

// Đăng video / Story 24 giờ / Duet (SPEC-creator.md mục 1 + bổ sung 27/10), giao diện V4.
export default async function UploadVideoPage({
  searchParams,
}: {
  searchParams: Promise<{ duet?: string; story?: string; stitch?: string; sound?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  await requireCommitment(
    user.id,
    `/video/dang${params.story ? '?story=1' : params.duet ? `?duet=${params.duet}` : params.stitch ? `?stitch=${params.stitch}` : ''}`,
  );
  // Stitch (SPEC-creator.md V5.5 mục 4): chỉ video công khai còn cho Duet/Stitch, là MP4 (máy chủ kiểm lại khi đăng).
  const [camera, watchOn] = await Promise.all([isFeatureOn('camera'), isFeatureOn('watch')]);
  const series = watchOn ? await mySeries(user.id) : [];
  const [t, videos, stories, duet, kiot, limits, stitch, sound] = await Promise.all([
    getT(),
    videosToday(user.id),
    videosToday(user.id, 'story'),
    params.duet ? getVideo(params.duet, {}) : Promise.resolve(null),
    getKiotByOwner(user.id),
    videoLimits(),
    params.stitch && camera ? getVideo(params.stitch, {}) : Promise.resolve(null),
    // "Dùng âm thanh này" (SPEC-creator.md V5.6 mục 2): âm thanh phải còn chọn được (máy chủ kiểm lại khi đăng).
    params.sound && camera ? selectableSound(params.sound) : Promise.resolve(null),
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
          stitch={
            stitch && stitch.fileUrl.endsWith('.mp4')
              ? {
                  id: stitch.id,
                  author: stitch.author.displayName,
                  fileUrl: stitch.fileUrl,
                  durationSec: stitch.durationSec ?? 0,
                }
              : null
          }
          provinces={PROVINCES.map((p) => ({ slug: p.slug, name: p.name }))}
          defaultProvince={kiot?.province ?? ''}
          limits={{ long: limits.long, maxBytes: limits.maxBytes, maxSec: limits.maxSec }}
          initialSound={sound}
          series={series.map((s) => ({ id: s.id, title: s.title, next: s.episodeCount + 1 }))}
        />
      </ClientMessages>
    </div>
  );
}
