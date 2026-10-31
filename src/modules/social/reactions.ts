import { now } from '@/lib/clock';
import { privateUserIds } from '@/lib/private-accounts';
import { db } from '@/lib/db';
import { notifyEvent } from '@/lib/notify-events';
import {
  canViewPost,
  canViewVideo,
  hydratePosts,
  hydrateVideos,
  type FeedVideo,
  type PostView,
} from '@/modules/creator';
import { heartVideo } from './hearts';

// Cảm xúc (SPEC-social.md V5.8): Thích, Thương, Haha, Wow, Buồn, Giận. Mỗi người một cảm xúc mỗi video / bài, đổi được.
// Số trên nút = tổng cảm xúc. Video dùng VideoLike.reaction (dòng cũ là like); bài dùng bảng Reaction.
export const REACTIONS = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const;
export type ReactionKind = (typeof REACTIONS)[number];
export type ReactionTarget = { videoId: string } | { postId: string };
export const isReaction = (r: unknown): r is ReactionKind => REACTIONS.includes(r as ReactionKind);

// Chọn / đổi / bỏ cảm xúc trên video. Thêm mới đi qua heartVideo (giới hạn Free, voucher, thông báo như tim).
export async function setVideoReaction(
  userId: string,
  videoId: string,
  reaction: ReactionKind | null,
): Promise<
  | { ok: true; reaction: ReactionKind | null; total: number }
  | { ok: false; error: 'NOT_FOUND' | 'FREE_LIMIT' }
> {
  const had = await db.videoLike.findUnique({ where: { videoId_userId: { videoId, userId } } });
  if (!reaction) {
    if (had) {
      const r = await heartVideo(userId, videoId, 'toggle');
      if (!r.ok) return r;
      return { ok: true, reaction: null, total: r.likes };
    }
    const v = await db.video.findUnique({ where: { id: videoId }, select: { likes: true } });
    return v ? { ok: true, reaction: null, total: v.likes } : { ok: false, error: 'NOT_FOUND' };
  }
  if (!had) {
    const r = await heartVideo(userId, videoId, 'like');
    if (!r.ok) return r;
  }
  await db.videoLike.update({ where: { videoId_userId: { videoId, userId } }, data: { reaction } });
  const v = await db.video.findUniqueOrThrow({ where: { id: videoId }, select: { likes: true } });
  return { ok: true, reaction, total: v.likes };
}

export async function setPostReaction(
  userId: string,
  postId: string,
  reaction: ReactionKind | null,
): Promise<{ ok: true; reaction: ReactionKind | null; total: number } | { ok: false; error: 'NOT_FOUND' }> {
  if (!(await canViewPost(postId, userId))) return { ok: false, error: 'NOT_FOUND' };
  const key = { userId_postId: { userId, postId } };
  const had = await db.reaction.findUnique({ where: key });
  const post = await db.$transaction(async (tx) => {
    if (!reaction) {
      if (!had)
        return tx.post.findUniqueOrThrow({ where: { id: postId }, select: { likes: true, authorId: true } });
      await tx.reaction.delete({ where: key });
      return tx.post.update({
        where: { id: postId },
        data: { likes: { decrement: 1 } },
        select: { likes: true, authorId: true },
      });
    }
    if (had) {
      await tx.reaction.update({ where: key, data: { reaction } });
      return tx.post.findUniqueOrThrow({ where: { id: postId }, select: { likes: true, authorId: true } });
    }
    await tx.reaction.create({ data: { userId, postId, reaction, createdAt: now() } });
    return tx.post.update({
      where: { id: postId },
      data: { likes: { increment: 1 } },
      select: { likes: true, authorId: true },
    });
  });
  if (reaction && !had && post.authorId !== userId) {
    const me = await db.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    await notifyEvent({
      userId: post.authorId,
      type: 'like',
      key: 'notify.postLiked',
      groupedKey: 'notify.postLikedMany',
      vars: { name: me?.displayName ?? '9MUA' },
      url: `/p/${postId}`,
      groupKey: `like:post:${postId}`,
    });
  }
  return { ok: true, reaction, total: Math.max(0, post.likes) };
}

// Bấm số trên nút: xem từng loại cảm xúc.
export async function reactionSummary(target: ReactionTarget): Promise<Record<ReactionKind, number>> {
  const out = Object.fromEntries(REACTIONS.map((r) => [r, 0])) as Record<ReactionKind, number>;
  const rows =
    'videoId' in target
      ? await db.videoLike.groupBy({
          by: ['reaction'],
          where: { videoId: target.videoId },
          _count: { _all: true },
        })
      : await db.reaction.groupBy({
          by: ['reaction'],
          where: { postId: target.postId },
          _count: { _all: true },
        });
  for (const r of rows) if (isReaction(r.reaction)) out[r.reaction] = r._count._all;
  return out;
}

export async function myReaction(userId: string, target: ReactionTarget): Promise<ReactionKind | null> {
  const row =
    'videoId' in target
      ? await db.videoLike.findUnique({ where: { videoId_userId: { videoId: target.videoId, userId } } })
      : await db.reaction.findUnique({ where: { userId_postId: { userId, postId: target.postId } } });
  return row && isReaction(row.reaction) ? row.reaction : null;
}

// Đăng lại (SPEC-social.md V5.9): video / bài public của người khác, mỗi người 1 lần, bỏ đăng lại được.
export async function toggleRepost(
  userId: string,
  target: ReactionTarget,
): Promise<{ ok: true; reposted: boolean } | { ok: false; error: 'NOT_FOUND' | 'OWN' }> {
  const item =
    'videoId' in target
      ? await db.video.findFirst({
          where: {
            id: target.videoId,
            status: 'ready',
            visibility: 'public',
            authorId: { notIn: await privateUserIds() },
          },
          select: { authorId: true },
        })
      : await db.post.findFirst({
          where: {
            id: target.postId,
            status: 'ready',
            visibility: 'public',
            authorId: { notIn: await privateUserIds() },
          },
          select: { authorId: true },
        });
  if (!item) return { ok: false, error: 'NOT_FOUND' };
  if (item.authorId === userId) return { ok: false, error: 'OWN' };
  const ok =
    'videoId' in target
      ? await canViewVideo(target.videoId, userId)
      : await canViewPost(target.postId, userId);
  if (!ok) return { ok: false, error: 'NOT_FOUND' };
  const where = 'videoId' in target ? { userId, videoId: target.videoId } : { userId, postId: target.postId };
  const removed = await db.repost.deleteMany({ where });
  if (removed.count) return { ok: true, reposted: false };
  await db.repost.create({ data: { ...where, createdAt: now() } });
  const me = await db.user.findUnique({ where: { id: userId }, select: { displayName: true } });
  await notifyEvent({
    userId: item.authorId,
    type: 'repost',
    key: 'notify.reposted',
    vars: { name: me?.displayName ?? '9MUA' },
    url: 'videoId' in target ? `/v/${target.videoId}` : `/p/${target.postId}`,
  });
  return { ok: true, reposted: true };
}

// Tab "Đăng lại" trên trang cá nhân: video và bài mình đã đăng lại, mới nhất trước.
export async function repostsOf(userId: string, take = 60) {
  return db.repost.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take });
}

// Tab "Đăng lại" trên trang cá nhân: chỉ nội dung người xem được phép xem.
export async function repostedContent(
  userId: string,
  viewerId: string | undefined,
): Promise<{ videos: FeedVideo[]; posts: PostView[] }> {
  const rows = await repostsOf(userId);
  const videoIds: string[] = [];
  const postIds: string[] = [];
  for (const r of rows) {
    if (r.videoId && (await canViewVideo(r.videoId, viewerId))) videoIds.push(r.videoId);
    if (r.postId && (await canViewPost(r.postId, viewerId))) postIds.push(r.postId);
  }
  return {
    videos: await hydrateVideos(videoIds, { userId: viewerId }),
    posts: await hydratePosts(postIds, { userId: viewerId }),
  };
}
