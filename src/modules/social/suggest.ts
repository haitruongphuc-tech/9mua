import { Prisma } from '@prisma/client';
import { blockedEitherIds, notBlockedWith } from '@/lib/blocks';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { cached, invalidateCached } from '@/lib/ttl-cache';
import { canViewVideo, hydrateVideos, type FeedVideo } from '@/modules/creator';

// Bạn chung, gợi ý follow (SPEC-social.md V5.1). Không tính tài khoản bị khoá hoặc đã chặn nhau.
export type PersonCard = { id: string; displayName: string; handle: string | null; avatarUrl: string | null };
const DISMISS_DAYS = 30;
const MIN_FOLLOWING = 3;

// Bạn chung: người MÌNH đang follow mà cũng follow trang này.
export async function mutualFollowers(
  viewerId: string,
  profileId: string,
  take = 3,
): Promise<{ total: number; people: PersonCard[] }> {
  if (viewerId === profileId) return { total: 0, people: [] };
  const rows = await db.$queryRaw<(PersonCard & { total: number })[]>`
    SELECT u.id, u."displayName", u.handle, u."avatarUrl", count(*) OVER ()::int AS total
    FROM "Follow" mine
    JOIN "Follow" theirs ON theirs."followerId" = mine."followeeId" AND theirs."followeeId" = ${profileId}
    JOIN "User" u ON u.id = mine."followeeId"
    WHERE mine."followerId" = ${viewerId} AND u."lockedAt" IS NULL
      AND ${notBlockedWith(viewerId, Prisma.sql`u.id`)}
    ORDER BY u."displayName" LIMIT ${take}`;
  return {
    total: rows[0]?.total ?? 0,
    people: rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      handle: r.handle,
      avatarUrl: r.avatarUrl,
    })),
  };
}

// Gợi ý: người được những người mình follow đang follow mà mình chưa follow; xếp theo số bạn chung rồi số người theo
// dõi. Mình follow dưới 3 người thì lấy creator có nhiều lượt thích nhất 30 ngày. Tính lại tối đa 1 lần mỗi giờ.
export async function followSuggestions(
  viewerId: string,
  take = 10,
): Promise<(PersonCard & { mutual: number })[]> {
  return cached(`suggest:${viewerId}`, 3600, () => computeSuggestions(viewerId, take));
}

async function computeSuggestions(
  viewerId: string,
  take: number,
): Promise<(PersonCard & { mutual: number })[]> {
  const since = new Date(now().getTime() - DISMISS_DAYS * 86_400_000);
  const blocked = [...(await blockedEitherIds(viewerId))];
  const exclude = Prisma.sql`u.id <> ${viewerId} AND u."lockedAt" IS NULL
    AND NOT (u.id = ANY(${blocked}))
    AND NOT EXISTS (SELECT 1 FROM "Follow" f WHERE f."followerId" = ${viewerId} AND f."followeeId" = u.id)
    AND NOT EXISTS (SELECT 1 FROM "SuggestionDismiss" d WHERE d."userId" = ${viewerId} AND d."targetId" = u.id
      AND d."createdAt" >= ${since})`;
  const following = await db.follow.count({ where: { followerId: viewerId } });
  const rows =
    following >= MIN_FOLLOWING
      ? await db.$queryRaw<(PersonCard & { mutual: number; followers: number })[]>`
          SELECT u.id, u."displayName", u.handle, u."avatarUrl", count(*)::int AS mutual,
            (SELECT count(*)::int FROM "Follow" x WHERE x."followeeId" = u.id) AS followers
          FROM "Follow" mine
          JOIN "Follow" theirs ON theirs."followerId" = mine."followeeId"
          JOIN "User" u ON u.id = theirs."followeeId"
          WHERE mine."followerId" = ${viewerId} AND ${exclude}
          GROUP BY u.id
          ORDER BY mutual DESC, followers DESC LIMIT ${take}`
      : await db.$queryRaw<(PersonCard & { mutual: number; followers: number })[]>`
          SELECT u.id, u."displayName", u.handle, u."avatarUrl", 0 AS mutual, sum(v.likes)::int AS followers
          FROM "Video" v JOIN "User" u ON u.id = v."authorId"
          WHERE v.status = 'ready' AND v.visibility = 'public' AND NOT u."isPrivate"
            AND v."readyAt" >= ${new Date(now().getTime() - 30 * 86_400_000)} AND ${exclude}
          GROUP BY u.id
          ORDER BY followers DESC LIMIT ${take}`;
  return rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    handle: r.handle,
    avatarUrl: r.avatarUrl,
    mutual: r.mutual,
  }));
}

// "Ẩn" một gợi ý trong 30 ngày.
export async function dismissSuggestion(viewerId: string, targetId: string): Promise<void> {
  await db.suggestionDismiss.upsert({
    where: { userId_targetId: { userId: viewerId, targetId } },
    create: { userId: viewerId, targetId, createdAt: now() },
    update: { createdAt: now() },
  });
  invalidateCached(`suggest:${viewerId}`);
}

// Tab "Đã thích" (SPEC-social.md V5.2): chủ trang luôn thấy; người khác chỉ khi chủ trang bật công khai.
export async function likedVideoIds(
  profileId: string,
  viewerId: string | undefined,
  take = 60,
): Promise<string[] | null> {
  if (viewerId !== profileId) {
    const u = await db.user.findUnique({ where: { id: profileId }, select: { showLikedVideos: true } });
    if (!u?.showLikedVideos) return null;
  }
  const rows = await db.videoLike.findMany({
    where: { userId: profileId },
    orderBy: { createdAt: 'desc' },
    take: take * 2,
    select: { videoId: true },
  });
  return rows.map((r) => r.videoId);
}

export async function setShowLikedVideos(userId: string, on: boolean): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { showLikedVideos: on } });
}

// Video trong tab "Đã thích": chỉ video người xem được phép xem (canViewVideo). null: tab ẩn với người xem này.
export async function likedVideos(
  profileId: string,
  viewerId: string | undefined,
  take = 60,
): Promise<FeedVideo[] | null> {
  const ids = await likedVideoIds(profileId, viewerId, take);
  if (!ids) return null;
  const allowed: string[] = [];
  for (const id of ids) {
    if (allowed.length >= take) break;
    if (await canViewVideo(id, viewerId)) allowed.push(id);
  }
  return hydrateVideos(allowed, { userId: viewerId });
}

export async function likedTabPublic(userId: string): Promise<boolean> {
  return Boolean(
    (await db.user.findUnique({ where: { id: userId }, select: { showLikedVideos: true } }))?.showLikedVideos,
  );
}

// Danh sách đầy đủ bạn chung (bấm vào dòng "bạn chung" trên trang cá nhân).
export async function mutualFollowerList(viewerId: string, profileId: string): Promise<PersonCard[]> {
  return (await mutualFollowers(viewerId, profileId, 200)).people;
}
