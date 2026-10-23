import { db } from '@/lib/db';

export type VideoThumb = {
  id: string;
  posterUrl: string | null;
  caption: string;
  views: number;
  likes: number;
  authorName: string;
};

export type CreatorProfile = {
  id: string;
  displayName: string;
  videoCount: number;
  totalLikes: number;
  videos: VideoThumb[];
};

// Trang creator (SPEC-creator.md mục 7). Tài khoản bị khoá thì không có trang.
export async function getCreatorProfile(userId: string): Promise<CreatorProfile | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, lockedAt: true },
  });
  if (!user || user.lockedAt) return null;
  const [videos, agg] = await Promise.all([
    db.video.findMany({
      where: { authorId: userId, status: 'ready' },
      orderBy: { readyAt: 'desc' },
      take: 60,
    }),
    db.video.aggregate({ where: { authorId: userId, status: 'ready' }, _count: true, _sum: { likes: true } }),
  ]);
  return {
    id: user.id,
    displayName: user.displayName,
    videoCount: agg._count,
    totalLikes: agg._sum.likes ?? 0,
    videos: videos.map((v) => ({
      id: v.id,
      posterUrl: v.posterUrl,
      caption: v.caption,
      views: v.views,
      likes: v.likes,
      authorName: user.displayName,
    })),
  };
}

// Khối "Video hot" trên trang chủ: điểm feed cao nhất, chỉ video đang hiện của tài khoản không bị khoá.
export async function getHotVideos(limit = 8): Promise<VideoThumb[]> {
  const rows = await db.video.findMany({
    where: { status: 'ready', fileUrl: { not: null } },
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
      authorName: name.get(v.authorId)!,
    }));
}
