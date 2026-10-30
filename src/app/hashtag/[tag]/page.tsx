import type { Metadata } from 'next';
import { VideoGrid } from '@/components/video/VideoGrid';
import { PostCard } from '@/components/post/PostCard';
import { ClientMessages } from '@/i18n/ClientMessages';
import { isFeatureOn } from '@/lib/features';
import { hashtagPosts } from '@/modules/creator';
import { getT } from '@/i18n/server';
import { readAnonId } from '@/lib/anon-id';
import { getCurrentUser } from '@/modules/identity';
import { hashtagVideos, normalizeTag } from '@/modules/social';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = normalizeTag(decodeURIComponent((await params).tag));
  return { title: `#${tag}`, alternates: { canonical: `/hashtag/${encodeURIComponent(tag)}` } };
}

// Trang hashtag (SPEC-social.md mục 5): video gắn hashtag, xếp theo điểm feed. Bố cục theo trang Khám phá V4.
export default async function HashtagPage({ params }: Props) {
  const tag = normalizeTag(decodeURIComponent((await params).tag));
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  const viewer = { userId: user?.id, anonId: await readAnonId() };
  const [videos, posts] = await Promise.all([
    hashtagVideos(tag, viewer),
    // Bài viết có hashtag (SPEC-creator.md V5.10 mục 2).
    isFeatureOn('posts').then((on) => (on ? hashtagPosts(tag, viewer) : [])),
  ]);
  return (
    <div>
      <div className="w-full bg-gradient-to-r from-brand to-orange-400 px-4 py-5 text-center">
        <h1 className="font-display text-[22px] font-bold md:text-[28px]">#{tag}</h1>
        <p className="text-[12px] font-bold text-white/90">
          {t('feed.hashtag.count', { count: videos.length })}
        </p>
      </div>
      <div className="mx-auto w-full max-w-[1100px] px-3 py-4 md:px-6">
        {posts.length ? (
          <ClientMessages prefixes={['feed.post.', 'feed.share']}>
            <h2 className="mb-2 text-[13px] font-black" data-testid="hashtag-posts">
              {t('feed.post.section', { count: posts.length })}
            </h2>
            <div className="mb-4 flex max-w-lg flex-col gap-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} loggedIn={Boolean(user)} />
              ))}
            </div>
          </ClientMessages>
        ) : null}
        {videos.length === 0 && posts.length === 0 ? (
          <p className="mt-10 text-center text-[13px] text-white/50">{t('feed.hashtag.empty', { tag })}</p>
        ) : (
          <VideoGrid
            showAuthor
            videos={videos.map((v) => ({
              id: v.id,
              posterUrl: v.posterUrl,
              caption: v.caption,
              views: v.views,
              likes: v.likes,
              authorName: v.author.displayName,
            }))}
          />
        )}
      </div>
    </div>
  );
}
