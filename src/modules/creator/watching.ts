import { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { viewerKey } from './engagement';
import type { Viewer } from './feed';
import type { VideoThumb } from './profile';

// "Không quan tâm" và lịch sử đã xem (SPEC-creator.md V5.2).
export const MAX_NOT_INTERESTED = 500;
export const NOT_INTERESTED_DAYS = 30;
export const HISTORY_DAYS = 90;
const HISTORY_PAGE = 30;

export async function markNotInterested(
  viewer: Viewer,
  videoId: string,
): Promise<{ ok: true } | { ok: false; error: 'NOT_FOUND' }> {
  const key = viewerKey(viewer);
  const video = await db.video.findUnique({ where: { id: videoId }, select: { authorId: true } });
  if (!key || !video) return { ok: false, error: 'NOT_FOUND' };
  await db.videoNotInterested.createMany({
    data: [{ viewerKey: key, videoId, authorId: video.authorId, createdAt: now() }],
    skipDuplicates: true,
  });
  // Giữ tối đa 500 dòng mỗi người: xoá dòng cũ nhất.
  await db.$executeRaw`
    DELETE FROM "VideoNotInterested" WHERE "viewerKey" = ${key} AND "videoId" IN (
      SELECT "videoId" FROM "VideoNotInterested" WHERE "viewerKey" = ${key}
      ORDER BY "createdAt" DESC OFFSET ${MAX_NOT_INTERESTED})`;
  return { ok: true };
}

// Điều kiện và điểm feed cho người xem: bỏ video đã bấm "Không quan tâm"; 30 ngày nhân điểm 0,2 cho video cùng người đăng.
export function notInterestedSql(viewer: Viewer): { exclude: Prisma.Sql; score: Prisma.Sql } {
  const key = viewerKey(viewer);
  if (!key) return { exclude: Prisma.empty, score: Prisma.sql`v.score` };
  const since = new Date(now().getTime() - NOT_INTERESTED_DAYS * 86_400_000);
  return {
    exclude: Prisma.sql`AND NOT EXISTS (SELECT 1 FROM "VideoNotInterested" ni
      WHERE ni."viewerKey" = ${key} AND ni."videoId" = v.id)`,
    score: Prisma.sql`(v.score * CASE WHEN EXISTS (SELECT 1 FROM "VideoNotInterested" na
      WHERE na."viewerKey" = ${key} AND na."authorId" = v."authorId" AND na."createdAt" >= ${since})
      THEN 0.2 ELSE 1 END)`,
  };
}

// Ghi lịch sử khi xem ≥ 3 giây (gọi từ recordViews). Tắt lịch sử thì không ghi.
export async function rememberViewed(userId: string, videoIds: string[]): Promise<void> {
  if (videoIds.length === 0) return;
  const user = await db.user.findUnique({ where: { id: userId }, select: { historyOff: true } });
  if (!user || user.historyOff) return;
  const at = now();
  await db.$executeRaw`
    INSERT INTO "ViewHistory" ("userId", "videoId", "lastViewedAt")
    VALUES ${Prisma.join(videoIds.map((id) => Prisma.sql`(${userId}, ${id}, ${at})`))}
    ON CONFLICT ("userId", "videoId") DO UPDATE SET "lastViewedAt" = EXCLUDED."lastViewedAt"`;
}

export async function viewHistory(
  userId: string,
  page = 1,
): Promise<{ items: (VideoThumb & { viewedAt: Date })[]; hasMore: boolean }> {
  const since = new Date(now().getTime() - HISTORY_DAYS * 86_400_000);
  const rows = await db.viewHistory.findMany({
    where: { userId, lastViewedAt: { gte: since } },
    orderBy: { lastViewedAt: 'desc' },
    skip: (Math.max(1, page) - 1) * HISTORY_PAGE,
    take: HISTORY_PAGE + 1,
  });
  const ids = rows.slice(0, HISTORY_PAGE).map((r) => r.videoId);
  const videos = await db.video.findMany({ where: { id: { in: ids }, status: 'ready' } });
  const authors = await db.user.findMany({
    where: { id: { in: videos.map((v) => v.authorId) } },
    select: { id: true, displayName: true },
  });
  const byId = new Map(videos.map((v) => [v.id, v]));
  const name = new Map(authors.map((a) => [a.id, a.displayName]));
  const items = rows.slice(0, HISTORY_PAGE).flatMap((r) => {
    const v = byId.get(r.videoId);
    return v
      ? [
          {
            id: v.id,
            posterUrl: v.posterUrl,
            caption: v.caption,
            views: v.views,
            likes: v.likes,
            authorName: name.get(v.authorId) ?? '',
            viewedAt: r.lastViewedAt,
          },
        ]
      : [];
  });
  return { items, hasMore: rows.length > HISTORY_PAGE };
}

export async function removeFromHistory(userId: string, videoId: string): Promise<void> {
  await db.viewHistory.deleteMany({ where: { userId, videoId } });
}

export async function clearViewHistory(userId: string): Promise<void> {
  await db.viewHistory.deleteMany({ where: { userId } });
}

export async function setHistoryOff(userId: string, off: boolean): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { historyOff: off } });
}

export async function isHistoryOff(userId: string): Promise<boolean> {
  return Boolean(
    (await db.user.findUnique({ where: { id: userId }, select: { historyOff: true } }))?.historyOff,
  );
}
