'use server';

import { redirect } from 'next/navigation';
import { deletePost, updatePost } from '@/modules/creator';
import { requireUser } from '@/modules/identity';
import { getT } from '@/i18n/server';

// Chủ bài xoá / sửa bài (SPEC-creator.md V5.10 mục 1).
export async function deletePostAction(postId: string): Promise<void> {
  const user = await requireUser();
  await deletePost(user.id, postId);
  redirect(`/creator/${user.id}`);
}

export async function updatePostAction(
  postId: string,
  input: {
    text: string;
    keepImageUrls: string[];
    imageIds: string[];
    productIds: string[];
    bgColor: string | null;
  },
): Promise<{ error: string }> {
  const user = await requireUser();
  const r = await updatePost(user.id, postId, {
    text: String(input.text ?? ''),
    keepImageUrls: Array.isArray(input.keepImageUrls) ? input.keepImageUrls.map(String) : [],
    imageIds: Array.isArray(input.imageIds) ? input.imageIds.map(String) : [],
    productIds: Array.isArray(input.productIds) ? input.productIds.map(String).slice(0, 4) : [],
    bgColor: typeof input.bgColor === 'string' ? input.bgColor : null,
  });
  if (!r.ok) return { error: (await getT())(`post.article.err.${r.error}`) };
  redirect(`/p/${postId}`);
}
