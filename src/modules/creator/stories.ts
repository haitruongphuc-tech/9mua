import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { imageStore } from '@/lib/media/image-store';

// Story 24 giờ (SPEC-creator.md bổ sung 27/10): mỗi người một vòng tròn, Story mới nhất trước.
export type StoryItem = { id: string; fileUrl: string; posterUrl: string | null; caption: string };
export type StoryGroup = { author: { id: string; displayName: string }; items: StoryItem[] };

export async function listStories(limitAuthors = 30): Promise<StoryGroup[]> {
  const rows = await db.video.findMany({
    where: { kind: 'story', status: 'ready', expiresAt: { gt: now() }, fileUrl: { not: null } },
    orderBy: { readyAt: 'asc' },
    take: 500,
    select: { id: true, authorId: true, fileUrl: true, posterUrl: true, caption: true, readyAt: true },
  });
  const authors = await db.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.authorId))] }, lockedAt: null },
    select: { id: true, displayName: true },
  });
  const byId = new Map(authors.map((a) => [a.id, a]));
  const groups = new Map<string, StoryGroup & { latest: number }>();
  for (const r of rows) {
    const author = byId.get(r.authorId);
    if (!author) continue;
    const g = groups.get(author.id) ?? { author, items: [], latest: 0 };
    g.items.push({ id: r.id, fileUrl: r.fileUrl!, posterUrl: r.posterUrl, caption: r.caption });
    g.latest = Math.max(g.latest, r.readyAt?.getTime() ?? 0);
    groups.set(author.id, g);
  }
  return [...groups.values()]
    .sort((a, b) => b.latest - a.latest)
    .slice(0, limitAuthors)
    .map(({ author, items }) => ({ author, items }));
}

// Story hết 24 giờ: chuyển trạng thái "expired" và xoá file sau 7 ngày (worker gọi định kỳ).
export async function expireStories(): Promise<number> {
  const t = now();
  const { count } = await db.video.updateMany({
    where: { kind: 'story', status: 'ready', expiresAt: { lte: t } },
    data: { status: 'expired' },
  });
  const old = await db.video.findMany({
    where: { kind: 'story', status: 'expired', expiresAt: { lte: new Date(t.getTime() - 7 * 86_400_000) } },
    select: { id: true, fileUrl: true, posterUrl: true },
    take: 200,
  });
  for (const v of old) {
    if (v.fileUrl) await imageStore().remove(v.fileUrl);
    if (v.posterUrl) await imageStore().remove(v.posterUrl);
    await db.video.update({
      where: { id: v.id },
      data: { status: 'deleted', fileUrl: null, posterUrl: null },
    });
  }
  return count;
}
