import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { extractHashtags, hydrateVideos, type FeedVideo, type Viewer } from '@/modules/creator';

// Chuẩn hoá giống lúc tách hashtag từ chú thích (bỏ dấu, chữ thường).
export const normalizeTag = (tag: string) => extractHashtags(`#${tag.replace(/^#/, '').trim()}`)[0] ?? '';

// Trang /hashtag/<tag>: video có hashtag đó, xếp theo điểm feed (SPEC-social.md mục 5).
export async function hashtagVideos(tag: string, viewer: Viewer, take = 60): Promise<FeedVideo[]> {
  const t = normalizeTag(tag);
  if (!t) return [];
  const rows = await db.video.findMany({
    where: { status: 'ready', kind: 'video', hashtags: { has: t } },
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
    WHERE v.status = 'ready' AND v.kind = 'video' AND v."readyAt" >= ${since}
    GROUP BY tag ORDER BY videos DESC, tag ASC LIMIT ${limit}`;
  return rows;
}
