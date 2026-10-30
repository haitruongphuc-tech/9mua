import { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import type { Viewer } from './feed';
import { rememberViewed } from './watching';

export const MIN_VIEW_SECONDS = 3;

const vnDay = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

export function viewerKey(viewer: Viewer): string | null {
  if (viewer.userId) return `u:${viewer.userId}`;
  if (viewer.anonId && /^[A-Za-z0-9_-]{16,64}$/.test(viewer.anonId)) return `a:${viewer.anonId}`;
  return null;
}

// Ghi lượt xem theo lô (SPEC-creator.md mục 4): ≥ 3 giây mới tính; mỗi người xem 1 lần mỗi video mỗi ngày.
// "Xem đủ" (≥ 50% thời lượng) tính riêng để chấm điểm feed.
export async function recordViews(
  viewer: Viewer,
  entries: { videoId: string; watchedSeconds: number }[],
): Promise<number> {
  const key = viewerKey(viewer);
  if (!key) return 0;
  const valid = new Map<string, number>();
  for (const e of entries.slice(0, 50))
    if (typeof e.videoId === 'string' && e.watchedSeconds >= MIN_VIEW_SECONDS)
      valid.set(e.videoId, Math.max(valid.get(e.videoId) ?? 0, Math.min(e.watchedSeconds, 3600)));
  if (valid.size === 0) return 0;

  const videos = await db.video.findMany({
    where: { id: { in: [...valid.keys()] }, status: 'ready' },
    select: { id: true, durationSec: true },
  });
  if (videos.length === 0) return 0;
  // Lịch sử đã xem (SPEC-creator.md V5.2): ghi mỗi lần xem ≥ 3 giây, không chỉ lần đầu trong ngày.
  if (viewer.userId)
    await rememberViewed(
      viewer.userId,
      videos.map((v) => v.id),
    );
  const day = vnDay(now());
  const at = now();
  const rows = videos.map((v) => ({
    videoId: v.id,
    qualified: (valid.get(v.id) ?? 0) >= (v.durationSec ?? Infinity) * 0.5,
  }));

  return db.$transaction(async (tx) => {
    const inserted = await tx.$queryRaw<{ videoId: string; qualified: boolean }[]>`
      INSERT INTO "VideoView" ("videoId", "viewerKey", day, qualified, "createdAt")
      VALUES ${Prisma.join(rows.map((r) => Prisma.sql`(${r.videoId}, ${key}, ${day}, ${r.qualified}, ${at})`))}
      ON CONFLICT ("videoId", "viewerKey", day) DO NOTHING
      RETURNING "videoId", qualified`;
    // Lượt xem đã ghi trong ngày nhưng giờ mới xem đủ 50%: nâng lên "xem đủ" đúng 1 lần.
    const upgradeIds = rows
      .filter((r) => r.qualified && !inserted.some((i) => i.videoId === r.videoId))
      .map((r) => r.videoId);
    const upgraded = upgradeIds.length
      ? await tx.$queryRaw<{ videoId: string }[]>`
          UPDATE "VideoView" SET qualified = true
          WHERE "viewerKey" = ${key} AND day = ${day} AND qualified = false AND "videoId" = ANY(${upgradeIds})
          RETURNING "videoId"`
      : [];
    for (const r of inserted)
      await tx.video.update({
        where: { id: r.videoId },
        data: { views: { increment: 1 }, ...(r.qualified ? { qualifiedViews: { increment: 1 } } : {}) },
      });
    for (const r of upgraded)
      await tx.video.update({ where: { id: r.videoId }, data: { qualifiedViews: { increment: 1 } } });
    return inserted.length;
  });
}

// Thích / bỏ thích (SPEC-creator.md mục 5). An toàn khi bấm liên tục: đếm theo dòng thật sự thêm/xoá.
export async function toggleLike(
  videoId: string,
  userId: string,
): Promise<{ ok: true; liked: boolean; likes: number } | { ok: false; error: 'NOT_FOUND' }> {
  return db.$transaction(async (tx) => {
    const video = await tx.video.findFirst({ where: { id: videoId, status: 'ready' }, select: { id: true } });
    if (!video) return { ok: false as const, error: 'NOT_FOUND' as const };
    const added = await tx.$executeRaw`
      INSERT INTO "VideoLike" ("videoId", "userId", "createdAt") VALUES (${videoId}, ${userId}, ${now()})
      ON CONFLICT DO NOTHING`;
    if (added === 1) {
      const v = await tx.video.update({ where: { id: videoId }, data: { likes: { increment: 1 } } });
      return { ok: true as const, liked: true, likes: v.likes };
    }
    const removed = await tx.videoLike.deleteMany({ where: { videoId, userId } });
    const v = removed.count
      ? await tx.video.update({ where: { id: videoId }, data: { likes: { decrement: 1 } } })
      : await tx.video.findUniqueOrThrow({ where: { id: videoId } });
    return { ok: true as const, liked: false, likes: v.likes };
  });
}

// Chỉ thích (không bỏ thích): chạm 2 lần lên video (SPEC-creator.md bổ sung 27/10).
export async function likeVideo(
  videoId: string,
  userId: string,
): Promise<{ ok: true; liked: true; likes: number } | { ok: false; error: 'NOT_FOUND' }> {
  return db.$transaction(async (tx) => {
    const video = await tx.video.findFirst({
      where: { id: videoId, status: 'ready' },
      select: { likes: true },
    });
    if (!video) return { ok: false as const, error: 'NOT_FOUND' as const };
    const added = await tx.$executeRaw`
      INSERT INTO "VideoLike" ("videoId", "userId", "createdAt") VALUES (${videoId}, ${userId}, ${now()})
      ON CONFLICT DO NOTHING`;
    if (!added) return { ok: true as const, liked: true as const, likes: video.likes };
    const v = await tx.video.update({ where: { id: videoId }, data: { likes: { increment: 1 } } });
    return { ok: true as const, liked: true as const, likes: v.likes };
  });
}
