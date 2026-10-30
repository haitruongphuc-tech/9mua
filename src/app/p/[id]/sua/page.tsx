import { notFound } from 'next/navigation';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { postForEdit } from '@/modules/creator';
import { requireUser } from '@/modules/identity';
import { PostEditor } from './PostEditor';

export const dynamic = 'force-dynamic';

// Sửa bài (SPEC-creator.md V5.10 mục 1): chỉ chủ bài.
export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!(await isFeatureOn('posts'))) notFound();
  const { id } = await params;
  const [t, post] = await Promise.all([getT(), postForEdit(user.id, id)]);
  if (!post) notFound();
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-[20px] font-bold">{t('feed.post.edit')}</h1>
      <ClientMessages prefixes={['post.']}>
        <PostEditor
          postId={post.id}
          initial={{
            text: post.text,
            images: post.images.map((i) => ({ url: i.url, thumbUrl: i.thumbUrl })),
            productIds: post.products.map((p) => p.productId),
            bgColor: post.bgColor,
          }}
        />
      </ClientMessages>
    </div>
  );
}
