'use server';

import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { createVideoUpload, isVisibility, type VideoOptions } from '@/modules/creator';
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
}): Promise<{ error: string }> {
  const user = await requireUser();
  const result = await createVideoUpload(user.id, String(input.uploadId), {
    caption: String(input.caption ?? ''),
    productIds: Array.isArray(input.productIds) ? input.productIds.map(String).slice(0, 10) : [],
    kind: input.kind === 'story' ? 'story' : 'video',
    duetOfId: typeof input.duetOfId === 'string' ? input.duetOfId : null,
    // Tuỳ chọn khi đăng chỉ nhận khi công tắc post_options bật (SPEC-creator.md V5.3).
    options:
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
        : undefined,
  });
  if (!result.ok) return { error: (await getT())(`post.err.${result.error}`) };
  redirect(
    input.options?.draft
      ? `/video/cua-toi?tab=nhap&moi=${result.videoId}`
      : `/video/cua-toi?moi=${result.videoId}`,
  );
}
