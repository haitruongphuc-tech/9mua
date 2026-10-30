import { now } from '@/lib/clock';
import { blockedEitherIds, isBlockedEither } from '@/lib/blocks';
import { db } from '@/lib/db';
import { notifyKey } from '@/lib/notifications';
import { canViewVideo } from '@/modules/creator';
import { hasLink } from './links';

// Bình luận video (SPEC-social.md mục 3).
export const MAX_COMMENT = 300;
export const COMMENT_GAP_MS = 10_000;
export const COMMENTS_PER_DAY = 100;
export const COMMENT_AUTO_HIDE_REPORTERS = 5;

export type CommentView = {
  id: string;
  text: string;
  createdAt: Date;
  pinned: boolean;
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

  const c = await db.comment.create({ data: { videoId, userId, parentId: rootId, text, createdAt: t } });
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
): Promise<{ items: CommentView[]; total: number }> {
  const video = await db.video.findUnique({ where: { id: videoId }, select: { authorId: true } });
  if (!video) return { items: [], total: 0 };
  const blocked = await blockedEitherIds(viewerId);
  if (blocked.has(video.authorId)) return { items: [], total: 0 };
  const rows = (
    await db.comment.findMany({
      where: { videoId, hiddenAt: null },
      orderBy: { createdAt: 'asc' },
      take: 500,
    })
  ).filter((r) => !blocked.has(r.userId));
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
    author: name.get(r.userId) ?? { id: r.userId, displayName: '9MUA', avatarUrl: null },
    byVideoAuthor: r.userId === video.authorId,
  });
  const roots = rows.filter((r) => !r.parentId);
  const items: CommentView[] = roots.map((r) => ({
    ...view(r),
    replies: rows.filter((x) => x.parentId === r.id).map(view),
  }));
  // Bình luận ghim lên đầu, còn lại mới nhất trước.
  items.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.getTime() - a.createdAt.getTime());
  return { items, total: rows.length };
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

export async function hideComment(commentId: string, ownerId: string): Promise<{ ok: boolean }> {
  const c = await ownerComment(commentId, ownerId);
  if (!c) return { ok: false };
  await db.comment.update({
    where: { id: c.id },
    data: { hiddenAt: now(), hiddenById: ownerId, pinnedAt: null },
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
