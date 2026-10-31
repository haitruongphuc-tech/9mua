import { db } from '@/lib/db';
import type { FeedVideo } from '@/modules/creator';
import { commentCounts } from './comments';
import { followingIds } from './follow';
import { savedSet } from './saves';

export type SocialFeedVideo = FeedVideo & {
  comments: number;
  saved: boolean;
  followingAuthor: boolean;
  reaction: string | null; // cảm xúc của người xem (SPEC-social.md V5.8); null: chưa thả
};

// Thêm số bình luận, đã lưu, đang follow người đăng cho các video của feed (tầng ứng dụng gọi sau creator.getFeed).
export async function decorateFeed(items: FeedVideo[], viewerId?: string): Promise<SocialFeedVideo[]> {
  const ids = items.map((v) => v.id);
  const [counts, saved, following, reactions] = await Promise.all([
    commentCounts(ids),
    viewerId ? savedSet(viewerId, ids) : Promise.resolve(new Set<string>()),
    viewerId
      ? followingIds(viewerId, [...new Set(items.map((v) => v.author.id))])
      : Promise.resolve(new Set<string>()),
    viewerId
      ? db.videoLike.findMany({
          where: { userId: viewerId, videoId: { in: ids } },
          select: { videoId: true, reaction: true },
        })
      : Promise.resolve([]),
  ]);
  const reactionOf = new Map(reactions.map((r) => [r.videoId, r.reaction]));
  return items.map((v) => ({
    ...v,
    comments: counts.get(v.id) ?? 0,
    saved: saved.has(v.id),
    followingAuthor: following.has(v.author.id),
    reaction: reactionOf.get(v.id) ?? null,
  }));
}
