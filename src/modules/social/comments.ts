import { now } from '@/lib/clock';
import { blockedEitherIds, isBlockedEither } from '@/lib/blocks';
import { db } from '@/lib/db';
import { withinRate } from '@/lib/rate-window';
import { notifyKey } from '@/lib/notifications';
import { canViewVideo } from '@/modules/creator';
import { hasLink } from './links';
import { isFeatureOn } from '@/lib/features';
import { recordMentions } from './mentions';
import { containsMuted, mutedFolded } from './muted';

// Bình luận video (SPEC-social.md mục 3).
export const MAX_COMMENT = 300;
export const COMMENT_GAP_MS = 10_000;
export const COMMENTS_PER_DAY = 100;
export const COMMENT_AUTO_HIDE_REPORTERS = 5;
export const COMMENT_LIKES_PER_MINUTE = 60;
export const COMMENT_TOP_LIKES = 3; // từ 3 tim trở lên thì đứng trên (sau bình luận ghim)

export type CommentView = {
  id: string;
  text: string;
  createdAt: Date;
  pinned: boolean;
  atSecond: number | null; // bình luận theo phút khi xem tập phim (SPEC-creator.md V5.9 mục 5)
  likeCount: number;
  liked: boolean;
  mutedHidden: boolean; // ẩn vì có từ cấm của chủ video (chỉ người viết và chủ video thấy)
  replyVideoId: string | null; // "Đã trả lời bằng video" (SPEC-creator.md V5.8), chỉ khi video trả lời đã lên
  author: { id: string; displayName: string; avatarUrl: string | null };
  byVideoAuthor: boolean;
  replies: Omit<CommentView, 'replies'>[];
};

type AddError =
  'TOO_LONG' | 'EMPTY' | 'HAS_LINK' | 'RATE_LIMIT' | 'DAILY_LIMIT' | 'NOT_FOUND' | 'BLOCKED' | 'COMMENTS_OFF';

export async function addComment(
  userId: string,
  videoId: string,
  rawText: string,
  parentId?: string | null,
  atSecond?: number | null,
): Promise<{ ok: true; id: string } | { ok: false; error: AddError }> {
  const text = rawText.trim();
  if (!text) return { ok: false, error: 'EMPTY' };
  if (text.length > MAX_COMMENT) return { ok: false, error: 'TOO_LONG' };
  if (hasLink(text)) return { ok: false, error: 'HAS_LINK' };
  const video = await db.video.findFirst({
    where: { id: videoId, status: 'ready' },
    select: { id: true, authorId: true, allowComments: true },
  });
  if (!video) return { ok: false, error: 'NOT_FOUND' };
  if (await isBlockedEither(userId, video.authorId)) return { ok: false, error: 'BLOCKED' };
  if (!(await canViewVideo(videoId, userId))) return { ok: false, error: 'NOT_FOUND' };
  // Chủ video tắt bình luận (SPEC-creator.md V5.3).
  if (!video.allowComments) return { ok: false, error: 'COMMENTS_OFF' };
  // Trả lời 1 cấp: trả lời một câu trả lời thì gắn vào bình luận gốc.
  let rootId: string | null = null;
  let parentAuthor: string | null = null;
  if (parentId) {
    const parent = await db.comment.findFirst({ where: { id: parentId, videoId, hiddenAt: null } });
    if (!parent) return { ok: false, error: 'NOT_FOUND' };
    rootId = parent.parentId ?? parent.id;
    parentAuthor = parent.userId;
    if (await isBlockedEither(userId, parent.userId)) return { ok: false, error: 'BLOCKED' };
  }
  const t = now();
  const [last, today] = await Promise.all([
    db.comment.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    db.comment.count({ where: { userId, createdAt: { gte: new Date(t.getTime() - 86_400_000) } } }),
  ]);
  if (last && t.getTime() - last.createdAt.getTime() < COMMENT_GAP_MS)
    return { ok: false, error: 'RATE_LIMIT' };
  if (today >= COMMENTS_PER_DAY) return { ok: false, error: 'DAILY_LIMIT' };

  const at =
    !rootId && Number.isInteger(atSecond) && atSecond! >= 0 && atSecond! <= 24 * 3600 ? atSecond! : null;
  // Từ cấm của chủ video (SPEC-social.md V5.4 mục 3): bình luận tự ẩn, người viết vẫn thấy.
  const social = await isFeatureOn('social_more');
  const muted = social && userId !== video.authorId && containsMuted(text, await mutedFolded(video.authorId));
  const c = await db.comment.create({
    data: {
      videoId,
      userId,
      parentId: rootId,
      text,
      atSecond: at,
      createdAt: t,
      ...(muted ? { hiddenAt: t, hiddenReason: 'keyword' } : {}),
    },
  });
  if (muted) return { ok: true, id: c.id };
  if (social)
    await recordMentions({ type: 'comment', id: c.id, url: `/video?v=${videoId}&binh-luan=1` }, userId, text);
  const me = await db.user.findUnique({ where: { id: userId }, select: { displayName: true } });
  const vars = { name: me?.displayName ?? '9MUA', text: text.slice(0, 60) };
  if (video.authorId !== userId)
    await notifyKey(video.authorId, 'notify.newComment', vars, `/video?v=${videoId}&binh-luan=1`);
  if (parentAuthor && parentAuthor !== userId && parentAuthor !== video.authorId)
    await notifyKey(parentAuthor, 'notify.newReply', vars, `/video?v=${videoId}&binh-luan=1`);
  return { ok: true, id: c.id };
}

// viewerId: người đang xem — không thấy bình luận của người chặn nhau với mình (SPEC-social.md V5.3).
export async function listComments(
  videoId: string,
  viewerId?: string | null,
): Promise<{ items: CommentView[]; total: number; mutedHidden: CommentView[] }> {
  const video = await db.video.findUnique({ where: { id: videoId }, select: { authorId: true } });
  if (!video) return { items: [], total: 0, mutedHidden: [] };
  const blocked = await blockedEitherIds(viewerId);
  if (blocked.has(video.authorId)) return { items: [], total: 0, mutedHidden: [] };
  const owner = viewerId === video.authorId;
  // Bình luận ẩn vì từ cấm: người viết thấy bình luận của mình; chủ video thấy trong mục "Đã ẩn" để hiện lại.
  const rows = (
    await db.comment.findMany({
      where: {
        videoId,
        OR: [
          { hiddenAt: null },
          ...(viewerId ? [{ hiddenReason: 'keyword', userId: viewerId }] : []),
          ...(owner ? [{ hiddenReason: 'keyword' }] : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    })
  ).filter((r) => !blocked.has(r.userId));
  const replyIds = rows.map((r) => r.replyVideoId).filter((x): x is string => Boolean(x));
  const readyReplies = new Set(
    replyIds.length
      ? (
          await db.video.findMany({ where: { id: { in: replyIds }, status: 'ready' }, select: { id: true } })
        ).map((v) => v.id)
      : [],
  );
  const likedSet = new Set(
    viewerId
      ? (
          await db.commentLike.findMany({
            where: { userId: viewerId, commentId: { in: rows.map((r) => r.id) } },
            select: { commentId: true },
          })
        ).map((l) => l.commentId)
      : [],
  );
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
    select: { id: true, displayName: true, avatarUrl: true },
  });
  const name = new Map(users.map((u) => [u.id, u]));
  const view = (r: (typeof rows)[number]) => ({
    id: r.id,
    text: r.text,
    createdAt: r.createdAt,
    pinned: Boolean(r.pinnedAt),
    atSecond: r.atSecond,
    likeCount: r.likeCount,
    liked: likedSet.has(r.id),
    mutedHidden: r.hiddenReason === 'keyword' && r.hiddenAt !== null,
    replyVideoId: r.replyVideoId && readyReplies.has(r.replyVideoId) ? r.replyVideoId : null,
    author: name.get(r.userId) ?? { id: r.userId, displayName: '9MUA', avatarUrl: null },
    byVideoAuthor: r.userId === video.authorId,
  });
  const roots = rows.filter((r) => !r.parentId);
  const items: CommentView[] = roots.map((r) => ({
    ...view(r),
    replies: rows.filter((x) => x.parentId === r.id).map(view),
  }));
  // Thứ tự (SPEC-social.md V5.4 mục 1): ghim → từ 3 tim trở lên, nhiều tim trước → mới nhất.
  const top = (c: CommentView) => (c.likeCount >= COMMENT_TOP_LIKES ? c.likeCount : 0);
  items.sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) || top(b) - top(a) || b.createdAt.getTime() - a.createdAt.getTime(),
  );
  // Chủ video: bình luận bị ẩn vì từ cấm tách riêng (đầu bảng hiện "Đã ẩn N bình luận…").
  const visible = owner ? items.filter((c) => !c.mutedHidden || c.author.id === viewerId) : items;
  return {
    items: visible,
    total: rows.filter((r) => r.hiddenAt === null).length,
    mutedHidden: owner ? items.filter((c) => c.mutedHidden && c.author.id !== viewerId) : [],
  };
}

export async function commentCounts(videoIds: string[]): Promise<Map<string, number>> {
  if (!videoIds.length) return new Map();
  const rows = await db.comment.groupBy({
    by: ['videoId'],
    where: { videoId: { in: videoIds }, hiddenAt: null },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.videoId, r._count._all]));
}

async function ownerComment(commentId: string, ownerId: string) {
  const c = await db.comment.findUnique({ where: { id: commentId } });
  if (!c) return null;
  const v = await db.video.findUnique({ where: { id: c.videoId }, select: { authorId: true } });
  return v?.authorId === ownerId ? c : null;
}

// Chỉ người đăng video ghim được, mỗi video 1 bình luận ghim (ghim cái mới thì bỏ ghim cái cũ).
export async function pinComment(commentId: string, ownerId: string): Promise<{ ok: boolean }> {
  const c = await ownerComment(commentId, ownerId);
  if (!c || c.parentId || c.hiddenAt) return { ok: false };
  await db.$transaction([
    db.comment.updateMany({
      where: { videoId: c.videoId, pinnedAt: { not: null } },
      data: { pinnedAt: null },
    }),
    ...(c.pinnedAt ? [] : [db.comment.update({ where: { id: c.id }, data: { pinnedAt: now() } })]),
  ]);
  return { ok: true };
}

// Tim bình luận (SPEC-social.md V5.4 mục 1): bấm lần nữa để bỏ; tối đa 60 lần mỗi phút; không tính giới hạn Free.
export async function toggleCommentLike(
  userId: string,
  commentId: string,
): Promise<
  { ok: true; liked: boolean; likeCount: number } | { ok: false; error: 'NOT_FOUND' | 'RATE_LIMIT' }
> {
  const c = await db.comment.findFirst({ where: { id: commentId, hiddenAt: null } });
  if (!c || !(await canViewVideo(c.videoId, userId))) return { ok: false, error: 'NOT_FOUND' };
  if (!(await withinRate(`comment-like:${userId}`, COMMENT_LIKES_PER_MINUTE)))
    return { ok: false, error: 'RATE_LIMIT' };
  const key = { commentId_userId: { commentId, userId } };
  const had = await db.commentLike.findUnique({ where: key });
  const updated = await db.$transaction(async (tx) => {
    if (had) await tx.commentLike.delete({ where: key });
    else await tx.commentLike.create({ data: { commentId, userId, createdAt: now() } });
    return tx.comment.update({
      where: { id: commentId },
      data: { likeCount: { increment: had ? -1 : 1 } },
      select: { likeCount: true },
    });
  });
  return { ok: true, liked: !had, likeCount: Math.max(0, updated.likeCount) };
}

// Trang đăng ?tra-loi=<id>: chỉ người đăng video có bình luận đó; bình luận còn hiện, chưa được trả lời.
export async function replyCardFor(
  userId: string,
  commentId: string,
): Promise<{ commentId: string; text: string; authorName: string } | null> {
  const c = await db.comment.findFirst({ where: { id: commentId, hiddenAt: null, replyVideoId: null } });
  if (!c) return null;
  const v = await db.video.findUnique({ where: { id: c.videoId }, select: { authorId: true } });
  if (v?.authorId !== userId) return null;
  const u = await db.user.findUnique({ where: { id: c.userId }, select: { displayName: true } });
  return { commentId: c.id, text: c.text, authorName: u?.displayName ?? '9MUA' };
}

// Video trả lời bình luận đã lên (SPEC-creator.md V5.8): báo người bình luận.
export async function notifyVideoReply(videoId: string): Promise<boolean> {
  const c = await db.comment.findFirst({ where: { replyVideoId: videoId }, select: { userId: true } });
  const v = await db.video.findUnique({ where: { id: videoId }, select: { authorId: true } });
  if (!c || !v || c.userId === v.authorId) return false;
  const author = await db.user.findUnique({ where: { id: v.authorId }, select: { displayName: true } });
  await notifyKey(c.userId, 'notify.videoReply', { name: author?.displayName ?? '9MUA' }, `/v/${videoId}`);
  return true;
}

// Chủ video bấm "Hiện lại" một bình luận bị ẩn vì từ cấm.
export async function unhideMutedComment(commentId: string, ownerId: string): Promise<{ ok: boolean }> {
  const c = await ownerComment(commentId, ownerId);
  if (!c || c.hiddenReason !== 'keyword') return { ok: false };
  await db.comment.update({ where: { id: c.id }, data: { hiddenAt: null, hiddenReason: null } });
  return { ok: true };
}

export async function hideComment(commentId: string, ownerId: string): Promise<{ ok: boolean }> {
  const c = await ownerComment(commentId, ownerId);
  if (!c) return { ok: false };
  await db.comment.update({
    where: { id: c.id },
    data: { hiddenAt: now(), hiddenById: ownerId, hiddenReason: 'owner', pinnedAt: null },
  });
  return { ok: true };
}

export async function reportComment(
  userId: string,
  commentId: string,
  reason: string,
): Promise<{ ok: boolean }> {
  const c = await db.comment.findUnique({ where: { id: commentId } });
  if (!c || c.userId === userId) return { ok: false };
  const added = await db.$executeRaw`
    INSERT INTO "CommentReport" ("commentId", "userId", reason, "createdAt")
    VALUES (${commentId}, ${userId}, ${reason.slice(0, 50)}, ${now()}) ON CONFLICT DO NOTHING`;
  if (added) {
    const updated = await db.comment.update({
      where: { id: commentId },
      data: { reportCount: { increment: 1 } },
    });
    if (updated.reportCount >= COMMENT_AUTO_HIDE_REPORTERS && !updated.hiddenAt)
      await db.comment.update({ where: { id: commentId }, data: { hiddenAt: now(), pinnedAt: null } });
  }
  return { ok: true };
}
