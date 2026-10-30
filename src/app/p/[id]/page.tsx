import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PostCard } from '@/components/post/PostCard';
import { ClientMessages } from '@/i18n/ClientMessages';
import { getT } from '@/i18n/server';
import { isFeatureOn } from '@/lib/features';
import { getPost } from '@/modules/creator';
import { getCurrentUser } from '@/modules/identity';
import { deletePostAction } from './actions';
import { PostComments } from './PostComments';
import { ReportPost } from './ReportPost';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = (await isFeatureOn('posts')) ? await getPost(id, {}) : null;
  if (!post) return { robots: { index: false } };
  const title = post.text.split('\n')[0]?.slice(0, 70) || `@${post.author.displayName}`;
  return {
    title,
    alternates: { canonical: `/p/${id}` },
    openGraph: { title, images: post.images[0] ? [post.images[0].url] : undefined },
  };
}

// Trang một bài viết (SPEC-creator.md V5.10): link chia sẻ 9mua.com/p/<id>, bình luận, báo cáo, chủ bài sửa / xoá.
export default async function PostPage({ params }: Props) {
  if (!(await isFeatureOn('posts'))) notFound();
  const { id } = await params;
  const [t, user] = await Promise.all([getT(), getCurrentUser()]);
  const post = await getPost(id, { userId: user?.id });
  if (!post) notFound();
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <ClientMessages prefixes={['feed.']}>
        <PostCard post={post} loggedIn={Boolean(user)} />
        {post.status !== 'ready' ? (
          <p
            className="rounded-[14px] bg-white/5 px-4 py-3 text-[12px] font-bold text-white/70"
            data-testid="post-status"
          >
            {t(post.status === 'draft' ? 'feed.post.isDraft' : 'feed.post.isScheduled')}
          </p>
        ) : null}
        {post.mine ? (
          <div className="flex gap-2">
            <Link
              href={`/p/${post.id}/sua`}
              className="flex h-10 items-center rounded-full bg-white/10 px-4 text-[12px] font-black"
              data-testid="post-edit"
            >
              {t('feed.post.edit')}
            </Link>
            <form action={deletePostAction.bind(null, post.id)}>
              <button
                type="submit"
                className="h-10 rounded-full border border-white/20 px-4 text-[12px] font-bold"
                data-testid="post-delete"
              >
                {t('feed.post.delete')}
              </button>
            </form>
          </div>
        ) : user ? (
          <ReportPost postId={post.id} />
        ) : null}
        <PostComments postId={post.id} loggedIn={Boolean(user)} allow={post.allowComments} />
      </ClientMessages>
    </div>
  );
}
