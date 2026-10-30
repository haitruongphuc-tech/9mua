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
  options?: VideoOptions;
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
          }
        : undefined,
  });
  if (!result.ok) return { error: (await getT())(`post.err.${result.error}`) };
  redirect(`/video/cua-toi?moi=${result.videoId}`);
}
