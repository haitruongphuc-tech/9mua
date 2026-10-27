import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { hydrateVideos, type FeedVideo, type Viewer } from '@/modules/creator';

// Lưu video (bookmark) — SPEC-social.md mục 4.
export async function toggleSave(userId: string, videoId: string): Promise<{ ok: boolean; saved: boolean }> {
  const removed = await db.savedVideo.deleteMany({ where: { userId, videoId } });
  if (removed.count) return { ok: true, saved: false };
  const exists = await db.video.count({ where: { id: videoId, status: 'ready' } });
  if (!exists) return { ok: false, saved: false };
  await db.savedVideo.create({ data: { userId, videoId } }).catch((e) => {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
  });
  return { ok: true, saved: true };
}

export async function savedVideos(viewer: Viewer & { userId: string }, take = 60): Promise<FeedVideo[]> {
  const rows = await db.savedVideo.findMany({
    where: { userId: viewer.userId },
    orderBy: { createdAt: 'desc' },
    take,
    select: { videoId: true },
  });
  return hydrateVideos(
    rows.map((r) => r.videoId),
    viewer,
  );
}

export async function savedSet(userId: string, videoIds: string[]): Promise<Set<string>> {
  if (!videoIds.length) return new Set();
  const rows = await db.savedVideo.findMany({
    where: { userId, videoId: { in: videoIds } },
    select: { videoId: true },
  });
  return new Set(rows.map((r) => r.videoId));
}
