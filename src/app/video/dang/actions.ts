'use server';

import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { createVideoUpload, isVisibility, setEpisode, type VideoOptions } from '@/modules/creator';
import { requireUser } from '@/modules/identity';

// Bước 2: tạo video / Story / Duet từ file đã tải lên; worker sẽ chuyển mã rồi đưa lên feed.
export async function createVideoAction(input: {
  uploadId: string;
  caption: string;
  productIds: string[];
  kind?: 'video' | 'story';
  duetOfId?: string | null;
  options?: VideoOptions & {
    province?: string;
    placeName?: string;
    aiGenerated?: boolean;
    draft?: boolean;
    publishAt?: string | null; // "2026-11-01T09:30:00+07:00" (giờ Việt Nam)
  };
  autoCaptions?: boolean; // phụ đề tự động (SPEC-creator.md V5.4), riêng công tắc auto_captions
  look?: string; // bộ lọc màu, làm đẹp (SPEC-creator.md V5.5), công tắc camera
  stitch?: { ofId: string; fromSec: number; toSec: number } | null; // Stitch (V5.5 mục 4), công tắc camera
  beauty?: number;
  editSpec?: unknown; // cắt, chữ, nhãn dán (V5.6 mục 1), công tắc camera; máy chủ kiểm bằng parseEditSpec
  sound?: { id: string; startSec: number; volume: number; originalVolume: number } | null; // nhạc nền (V5.6 mục 2)
  series?: { id: string; episodeNo: number; watchOnly: boolean } | null; // tập phim (V5.9 mục 2), công tắc watch
}): Promise<{ error: string }> {
  const user = await requireUser();
  const autoCaptions = input.autoCaptions === true && (await isFeatureOn('auto_captions'));
  const camera = await isFeatureOn('camera');
  const looks = camera
    ? {
        look: typeof input.look === 'string' ? input.look : null,
        beauty: Number(input.beauty) || 0,
        editSpec: input.editSpec,
        sound:
          input.sound && typeof input.sound.id === 'string'
            ? {
                id: input.sound.id,
                startSec: Number(input.sound.startSec),
                volume: Number(input.sound.volume),
                originalVolume: Number(input.sound.originalVolume),
              }
            : null,
      }
    : {};
  // Tuỳ chọn khi đăng chỉ nhận khi công tắc post_options bật (SPEC-creator.md V5.3).
  const postOptions =
    input.options && (await isFeatureOn('post_options'))
      ? {
          visibility: isVisibility(input.options.visibility) ? input.options.visibility : 'public',
          allowComments: input.options.allowComments !== false,
          allowRemix: input.options.allowRemix !== false,
          allowDownload: input.options.allowDownload !== false,
          province: typeof input.options.province === 'string' ? input.options.province : null,
          placeName: typeof input.options.placeName === 'string' ? input.options.placeName : null,
          aiGenerated: input.options.aiGenerated === true,
          draft: input.options.draft === true,
          publishAt:
            typeof input.options.publishAt === 'string' && input.options.publishAt
              ? new Date(input.options.publishAt)
              : null,
        }
      : undefined;
  const result = await createVideoUpload(user.id, String(input.uploadId), {
    caption: String(input.caption ?? ''),
    productIds: Array.isArray(input.productIds) ? input.productIds.map(String).slice(0, 10) : [],
    kind: input.kind === 'story' ? 'story' : 'video',
    duetOfId: typeof input.duetOfId === 'string' ? input.duetOfId : null,
    stitch:
      camera && input.stitch && typeof input.stitch.ofId === 'string'
        ? {
            ofId: input.stitch.ofId,
            fromSec: Number(input.stitch.fromSec),
            toSec: Number(input.stitch.toSec),
          }
        : null,
    options: { ...postOptions, ...looks, ...(autoCaptions ? { autoCaptions } : {}) },
  });
  if (!result.ok) return { error: (await getT())(`post.err.${result.error}`) };
  // Gắn tập phim ngay khi đăng; số tập trùng / sai thì mở trang phim để sửa (video vẫn đăng như thường).
  if (input.series && typeof input.series.id === 'string' && (await isFeatureOn('watch'))) {
    const ep = await setEpisode(user.id, result.videoId, {
      seriesId: input.series.id,
      episodeNo: Number(input.series.episodeNo),
      watchOnly: input.series.watchOnly === true,
    });
    if (!ep.ok) redirect(`/video/cua-toi/phim/${encodeURIComponent(input.series.id)}?loi=${ep.error}`);
  }
  redirect(
    input.options?.draft
      ? `/video/cua-toi?tab=nhap&moi=${result.videoId}`
      : `/video/cua-toi?moi=${result.videoId}`,
  );
}
