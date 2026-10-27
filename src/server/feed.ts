// Ghép feed ở tầng ứng dụng: video từ creator (Dành cho bạn) hoặc social (Đang Follow), rồi thêm số bình luận,
// đã lưu, đang follow (SPEC-social.md). Trang chủ, /video, /v/<id> và API cuộn tiếp dùng chung.
import { getFeed, type Viewer } from '@/modules/creator';
import { decorateFeed, followingFeed, type SocialFeedVideo } from '@/modules/social';

export type FeedTab = 'for-you' | 'following';
export type FeedPage = { items: SocialFeedVideo[]; nextCursor: string | null };

export async function loadFeed(
  viewer: Viewer,
  opts: { tab?: FeedTab; cursor?: string; first?: string } = {},
): Promise<FeedPage> {
  const page =
    opts.tab === 'following'
      ? viewer.userId
        ? await followingFeed({ ...viewer, userId: viewer.userId }, opts.cursor)
        : { items: [], nextCursor: null }
      : await getFeed(viewer, opts.cursor, { first: opts.first });
  return { items: await decorateFeed(page.items, viewer.userId), nextCursor: page.nextCursor };
}
