import { Prisma } from '@prisma/client';
import { notPrivateAuthor } from '@/lib/private-accounts';
import { isBlockedEither } from '@/lib/blocks';
import { db } from '@/lib/db';

// Quyền riêng tư từng video (SPEC-creator.md V5.3): public (mọi người) | followers (người đang follow) | private (chỉ
// mình tôi). Video không public không vào feed Dành cho bạn, hashtag, tìm kiếm, video hot, sitemap, nhúng.
export const VISIBILITIES = ['public', 'followers', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];
export const isVisibility = (v: unknown): v is Visibility => VISIBILITIES.includes(v as Visibility);

// Điều kiện SQL "người xem được thấy video v" cho danh sách theo người (trang cá nhân, tab Đang Follow).
export function visibleToSql(viewerId: string | undefined | null): Prisma.Sql {
  const open = Prisma.sql`(v.visibility = 'public' AND ${notPrivateAuthor(Prisma.sql`v."authorId"`)})`;
  if (!viewerId) return open;
  return Prisma.sql`(${open} OR v."authorId" = ${viewerId}
    OR (v.visibility IN ('followers', 'public') AND EXISTS (SELECT 1 FROM "Follow" fv
      WHERE fv."followerId" = ${viewerId} AND fv."followeeId" = v."authorId")))`;
}

// Hàm dùng chung cho mọi nơi hiện một video cụ thể: /v/<id>, bình luận, tải về, nhúng, Duet, Stitch…
export async function canViewVideo(videoId: string, viewerId?: string | null): Promise<boolean> {
  const v = await db.video.findUnique({
    where: { id: videoId },
    select: { authorId: true, status: true, visibility: true },
  });
  if (!v || v.status === 'deleted') return false;
  if (viewerId && viewerId === v.authorId) return true;
  if (v.status !== 'ready') return false;
  const author = await db.user.findUnique({
    where: { id: v.authorId },
    select: { lockedAt: true, isPrivate: true },
  });
  if (!author || author.lockedAt) return false;
  if (viewerId && (await isBlockedEither(viewerId, v.authorId))) return false;
  if (v.visibility === 'public' && !author.isPrivate) return true;
  // Tài khoản riêng tư (SPEC-identity.md V5.2): video public hiển thị như followers.
  if (v.visibility === 'private' || !viewerId) return false;
  const follows = await db.follow.count({ where: { followerId: viewerId, followeeId: v.authorId } });
  return follows > 0;
}

export type VideoOptions = {
  visibility?: Visibility;
  allowComments?: boolean;
  allowRemix?: boolean;
  allowDownload?: boolean;
};

// Chủ video đổi quyền riêng tư và các tuỳ chọn (khi đăng hoặc sau khi đăng).
export async function setVideoOptions(
  userId: string,
  videoId: string,
  options: VideoOptions,
): Promise<{ ok: true } | { ok: false; error: 'NOT_FOUND' | 'INVALID' }> {
  if (options.visibility !== undefined && !isVisibility(options.visibility))
    return { ok: false, error: 'INVALID' };
  const { count } = await db.video.updateMany({
    where: { id: videoId, authorId: userId, status: { not: 'deleted' } },
    data: {
      visibility: options.visibility,
      allowComments: options.allowComments,
      allowRemix: options.allowRemix,
      allowDownload: options.allowDownload,
    },
  });
  return count === 1 ? { ok: true } : { ok: false, error: 'NOT_FOUND' };
}
