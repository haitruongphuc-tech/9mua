'use server';

import { redirect } from 'next/navigation';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { createPost } from '@/modules/creator';
import { requireUser } from '@/modules/identity';
import { recordMentions } from '@/modules/social';

// Đăng bài ảnh + chữ (SPEC-creator.md V5.10, công tắc posts). Máy chủ kiểm lại mọi giới hạn.
export async function createPostAction(input: {
  text: string;
  imageIds: string[];
  bgColor: string | null;
  productIds: string[];
  visibility: string;
  draft: boolean;
}): Promise<{ error: string }> {
  const user = await requireUser();
  const t = await getT();
  if (!(await isFeatureOn('posts'))) return { error: t('post.article.off') };
  const options = await isFeatureOn('post_options');
  const r = await createPost(user.id, {
    text: String(input.text ?? ''),
    imageIds: Array.isArray(input.imageIds) ? input.imageIds.map(String).slice(0, 11) : [],
    bgColor: typeof input.bgColor === 'string' ? input.bgColor : null,
    productIds: Array.isArray(input.productIds) ? input.productIds.map(String).slice(0, 4) : [],
    visibility: options ? String(input.visibility) : 'public',
    draft: options && input.draft === true,
  });
  if (!r.ok) return { error: t(`post.article.err.${r.error}`) };
  if (!(options && input.draft === true))
    await recordMentions(
      { type: 'post', id: r.postId, url: `/p/${r.postId}` },
      user.id,
      String(input.text ?? ''),
    );
  redirect(`/p/${r.postId}`);
}
