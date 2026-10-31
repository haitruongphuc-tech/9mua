import { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { notPrivateAuthor, privateUserIds } from '@/lib/private-accounts';
import { db } from '@/lib/db';
import { normalizeSearchText } from '@/lib/search-text';
import { extractHashtags, hydrateVideos, type FeedVideo, type Viewer } from '@/modules/creator';

// Chuẩn hoá giống lúc tách hashtag từ chú thích (bỏ dấu, chữ thường).
export const normalizeTag = (tag: string) => extractHashtags(`#${tag.replace(/^#/, '').trim()}`)[0] ?? '';

// Trang /hashtag/<tag>: video có hashtag đó, xếp theo điểm feed (SPEC-social.md mục 5).
export async function hashtagVideos(tag: string, viewer: Viewer, take = 60): Promise<FeedVideo[]> {
  const t = normalizeTag(tag);
  if (!t) return [];
  const rows = await db.video.findMany({
    where: {
      status: 'ready',
      kind: 'video',
      visibility: 'public',
      hashtags: { has: t },
      authorId: { notIn: await privateUserIds() },
    },
    orderBy: [{ score: 'desc' }, { readyAt: 'desc' }],
    take,
    select: { id: true },
  });
  return hydrateVideos(
    rows.map((r) => r.id),
    viewer,
  );
}

export async function trendingHashtags(limit = 10): Promise<{ tag: string; videos: number }[]> {
  const since = new Date(now().getTime() - 7 * 86_400_000);
  const rows = await db.$queryRaw<{ tag: string; videos: number }[]>`
    SELECT tag, COUNT(*)::int AS videos FROM "Video" v, unnest(v.hashtags) AS tag
    WHERE v.status = 'ready' AND v.kind = 'video' AND v.visibility = 'public' AND v."readyAt" >= ${since}
      AND ${notPrivateAuthor(Prisma.sql`v."authorId"`)}
    GROUP BY tag ORDER BY videos DESC, tag ASC LIMIT ${limit}`;
  return rows;
}

// Tìm hashtag theo tên (SPEC-social.md bổ sung 30/10, A3): kèm số video đang lên feed, nhiều video lên trước.
export async function searchHashtags(
  query: string,
  limit: number,
): Promise<{ tag: string; videos: number }[]> {
  const q = normalizeSearchText(query).replace(/ /g, '');
  if (!q) return [];
  return db.$queryRaw<{ tag: string; videos: number }[]>`
    SELECT tag, COUNT(*)::int AS videos
    FROM "Video" v JOIN "User" u ON u.id = v."authorId", unnest(v.hashtags) AS tag
    WHERE v.status = 'ready' AND v.kind = 'video' AND v.visibility = 'public' AND u."lockedAt" IS NULL
      AND NOT u."isPrivate" AND tag LIKE ${`%${q}%`}
    GROUP BY tag ORDER BY videos DESC, tag ASC LIMIT ${limit}`;
}
