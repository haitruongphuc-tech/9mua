'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { editVideo, isVisibility, MAX_CAPTION, MAX_PRODUCTS_PER_VIDEO } from '@/modules/creator';
import { requireUser } from '@/modules/identity';
import { recordMentions } from '@/modules/social';

export async function editVideoAction(input: {
  videoId: string;
  caption: string;
  productIds: string[];
  visibility: string;
  allowComments: boolean;
  allowRemix: boolean;
  allowDownload: boolean;
  province: string;
  placeName: string;
  aiGenerated: boolean;
}): Promise<{ error: string }> {
  const user = await requireUser();
  const t = await getT();
  if (!(await isFeatureOn('post_options'))) return { error: t('post.mine.err.NOT_FOUND') };
  const result = await editVideo(
    user.id,
    String(input.videoId),
    {
      caption: String(input.caption ?? ''),
      productIds: Array.isArray(input.productIds) ? input.productIds.map(String).slice(0, 10) : [],
      visibility: isVisibility(input.visibility) ? input.visibility : 'public',
      allowComments: input.allowComments !== false,
      allowRemix: input.allowRemix !== false,
      allowDownload: input.allowDownload !== false,
      province: String(input.province ?? ''),
      placeName: String(input.placeName ?? ''),
      aiGenerated: input.aiGenerated === true,
    },
    { maxCaption: MAX_CAPTION, maxProducts: MAX_PRODUCTS_PER_VIDEO },
  );
  if (!result.ok)
    return {
      error: t(result.error === 'NOT_FOUND' ? 'post.mine.err.NOT_FOUND' : `post.err.${result.error}`),
    };
  await recordMentions(
    { type: 'video', id: String(input.videoId), url: `/v/${String(input.videoId)}` },
    user.id,
    String(input.caption ?? ''),
  );
  revalidatePath('/video/cua-toi');
  redirect('/video/cua-toi?sua=1');
}
