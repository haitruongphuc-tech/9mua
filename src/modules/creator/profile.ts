import { db } from '@/lib/db';
import { privateUserIds } from '@/lib/private-accounts';

export type VideoThumb = {
  id: string;
  posterUrl: string | null;
  caption: string;
  views: number;
  likes: number;
  authorName: string;
  pinned?: boolean; // ghim lên đầu trang cá nhân (SPEC-creator.md V5.3)
  previewUrl?: string | null; // ảnh xem trước động khi giữ ngón tay / di chuột (SPEC-creator.md V5.1)
};

export type CreatorProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  videoCount: number;
  totalLikes: number;
  videos: VideoThumb[];
};

// Trang creator (SPEC-creator.md mục 7). Tài khoản bị khoá thì không có trang.
// viewerId: người đang xem — chủ trang thấy mọi video; người follow thấy thêm video "người follow"; người khác chỉ thấy
// video công khai (SPEC-creator.md V5.3).
export async function getCreatorProfile(
  userId: string,
  viewerId?: string | null,
): Promise<CreatorProfile | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      coverUrl: true,
      bio: true,
      lockedAt: true,
      isPrivate: true,
    },
  });
  if (!user || user.lockedAt) return null;
  const follower =
    viewerId && viewerId !== userId
      ? (await db.follow.count({ where: { followerId: viewerId, followeeId: userId } })) > 0
      : false;
  const visibility =
    viewerId === userId
      ? undefined
      : // Tài khoản riêng tư (SPEC-identity.md V5.2): người chưa follow không thấy video.
        { in: follower ? ['public', 'followers'] : user.isPrivate ? [] : ['public'] };
  const where = { authorId: userId, status: 'ready', kind: 'video', visibility };
  const [videos, agg] = await Promise.all([
    // Video ghim (tối đa 3) đứng đầu lưới, ghim mới nhất trước.
    db.video.findMany({
      where,
      orderBy: [{ profilePinnedAt: { sort: 'desc', nulls: 'last' } }, { readyAt: 'desc' }],
      take: 60,
    }),
    db.video.aggregate({ where, _count: true, _sum: { likes: true } }),
  ]);
  return {
    id: user.id,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    bio: user.bio,
    videoCount: agg._count,
    totalLikes: agg._sum.likes ?? 0,
    videos: videos.map((v) => ({
      id: v.id,
      posterUrl: v.posterUrl,
      caption: v.caption,
      views: v.views,
      likes: v.likes,
      previewUrl: v.previewUrl,
      authorName: user.displayName,
      pinned: v.profilePinnedAt !== null,
    })),
  };
}

// Khối "Video hot" trên trang chủ: điểm feed cao nhất, chỉ video đang hiện của tài khoản không bị khoá.
export async function getHotVideos(limit = 8): Promise<VideoThumb[]> {
  const rows = await db.video.findMany({
    where: {
      status: 'ready',
      kind: 'video',
      visibility: 'public',
      fileUrl: { not: null },
      authorId: { notIn: await privateUserIds() },
    },
    orderBy: [{ score: 'desc' }, { readyAt: 'desc' }],
    take: limit * 3,
  });
  const authors = await db.user.findMany({
    where: { id: { in: rows.map((r) => r.authorId) }, lockedAt: null },
    select: { id: true, displayName: true },
  });
  const name = new Map(authors.map((a) => [a.id, a.displayName]));
  return rows
    .filter((r) => name.has(r.authorId))
    .slice(0, limit)
    .map((v) => ({
      id: v.id,
      posterUrl: v.posterUrl,
      caption: v.caption,
      views: v.views,
      likes: v.likes,
      previewUrl: v.previewUrl,
      authorName: name.get(v.authorId)!,
    }));
}
