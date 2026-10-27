import type { FeedVideo } from '@/modules/creator';
import { commentCounts } from './comments';
import { followingIds } from './follow';
import { savedSet } from './saves';

export type SocialFeedVideo = FeedVideo & { comments: number; saved: boolean; followingAuthor: boolean };

// Thêm số bình luận, đã lưu, đang follow người đăng cho các video của feed (tầng ứng dụng gọi sau creator.getFeed).
export async function decorateFeed(items: FeedVideo[], viewerId?: string): Promise<SocialFeedVideo[]> {
  const ids = items.map((v) => v.id);
  const [counts, saved, following] = await Promise.all([
    commentCounts(ids),
    viewerId ? savedSet(viewerId, ids) : Promise.resolve(new Set<string>()),
    viewerId
      ? followingIds(viewerId, [...new Set(items.map((v) => v.author.id))])
      : Promise.resolve(new Set<string>()),
  ]);
  return items.map((v) => ({
    ...v,
    comments: counts.get(v.id) ?? 0,
    saved: saved.has(v.id),
    followingAuthor: following.has(v.author.id),
  }));
}
