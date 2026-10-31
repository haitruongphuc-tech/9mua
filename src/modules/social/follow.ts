import { Prisma } from '@prisma/client';
import { isBlockedEither } from '@/lib/blocks';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { isFeatureOn } from '@/lib/features';
import { notifyEvent } from '@/lib/notify-events';
import { notifyKey } from '@/lib/notifications';
import { hydrateVideos, type FeedVideo, type Viewer } from '@/modules/creator';
import { consumeDailyAction } from './limits';

// Một trong hai người follow người kia (SPEC-messages.md: nhắn tin vào thẳng hộp thư chính).
export async function followRelation(a: string, b: string): Promise<boolean> {
  const n = await db.follow.count({
    where: {
      OR: [
        { followerId: a, followeeId: b },
        { followerId: b, followeeId: a },
      ],
    },
  });
  return n > 0;
}

// Follow một tài khoản (creator / chủ Kiot) — SPEC-social.md mục 1.
export async function toggleFollow(
  followerId: string,
  followeeId: string,
): Promise<
  | { ok: true; following: boolean; followers: number }
  | { ok: false; error: 'SELF' | 'FREE_LIMIT' | 'NOT_FOUND' | 'BLOCKED' }
> {
  if (followerId === followeeId) return { ok: false, error: 'SELF' };
  const target = await db.user.findUnique({ where: { id: followeeId }, select: { lockedAt: true } });
  if (!target || target.lockedAt) return { ok: false, error: 'NOT_FOUND' };
  // Chặn nhau (SPEC-social.md V5.3) thì không follow được, kể cả bỏ follow đã bị gỡ sẵn khi chặn.
  if (await isBlockedEither(followerId, followeeId)) return { ok: false, error: 'BLOCKED' };
  const removed = await db.follow.deleteMany({ where: { followerId, followeeId } });
  let following = false;
  if (removed.count === 0) {
    const allowed = await consumeDailyAction(followerId);
    if (!allowed.ok) return allowed;
    await db.follow.create({ data: { followerId, followeeId } }).catch((e) => {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    });
    following = true;
    // Có người follow mình (SPEC-social.md V5.5), gộp theo giờ.
    if (await isFeatureOn('social_more')) {
      const me = await db.user.findUnique({ where: { id: followerId }, select: { displayName: true } });
      await notifyEvent({
        userId: followeeId,
        type: 'follow',
        key: 'notify.newFollower',
        groupedKey: 'notify.newFollowers',
        vars: { name: me?.displayName ?? '9MUA' },
        url: `/creator/${followerId}`,
        groupKey: 'follow',
      });
    }
  }
  return { ok: true, following, followers: await db.follow.count({ where: { followeeId } }) };
}

export async function followStats(userId: string, viewerId?: string) {
  const [followers, following, me] = await Promise.all([
    db.follow.count({ where: { followeeId: userId } }),
    db.follow.count({ where: { followerId: userId } }),
    viewerId
      ? db.follow.findUnique({
          where: { followerId_followeeId: { followerId: viewerId, followeeId: userId } },
        })
      : null,
  ]);
  return { followers, following, isFollowing: Boolean(me) };
}

export async function followingIds(viewerId: string, authorIds: string[]): Promise<Set<string>> {
  if (!authorIds.length) return new Set();
  const rows = await db.follow.findMany({
    where: { followerId: viewerId, followeeId: { in: authorIds } },
    select: { followeeId: true },
  });
  return new Set(rows.map((r) => r.followeeId));
}

const PAGE = 8;

// Tab "Đang Follow": video mới nhất của người mình follow (SPEC-social.md mục 2). Con trỏ = readyAt|id.
export async function followingFeed(
  viewer: Viewer & { userId: string },
  cursor?: string,
): Promise<{ items: FeedVideo[]; nextCursor: string | null }> {
  const [at, id] = (cursor ?? '').split('|');
  const after = at && id ? Prisma.sql`AND (v."readyAt", v.id) < (${new Date(at)}, ${id})` : Prisma.empty;
  const rows = await db.$queryRaw<{ id: string; readyAt: Date }[]>`
    SELECT v.id, v."readyAt" FROM "Video" v
    JOIN "User" u ON u.id = v."authorId"
    JOIN "Follow" f ON f."followeeId" = v."authorId" AND f."followerId" = ${viewer.userId}
    WHERE v.status = 'ready' AND v.kind = 'video' AND v.visibility <> 'private' AND u."lockedAt" IS NULL
      AND v."watchOnly" = false ${after}
    ORDER BY v."readyAt" DESC, v.id DESC LIMIT ${PAGE + 1}`;
  const page = rows.slice(0, PAGE);
  const last = page.at(-1);
  const items = await hydrateVideos(
    page.map((r) => r.id),
    viewer,
  );
  // Đăng lại (SPEC-social.md V5.9): trang đầu chèn video người mình follow đã đăng lại trong 3 ngày, sau mỗi 2 video.
  if (!cursor) {
    const since = new Date(now().getTime() - 3 * 86_400_000);
    const reposts = await db.$queryRaw<{ videoId: string; name: string }[]>`
      SELECT DISTINCT ON (r."videoId") r."videoId", u."displayName" AS name
      FROM "Repost" r JOIN "Follow" f ON f."followeeId" = r."userId" AND f."followerId" = ${viewer.userId}
      JOIN "User" u ON u.id = r."userId"
      JOIN "Video" v ON v.id = r."videoId"
      WHERE r."videoId" IS NOT NULL AND r."createdAt" >= ${since} AND v.status = 'ready'
        AND v.visibility = 'public' AND v."authorId" <> ${viewer.userId}
      ORDER BY r."videoId", r."createdAt" DESC LIMIT 10`;
    const fresh = reposts.filter((r) => !items.some((v) => v.id === r.videoId)).slice(0, 5);
    const hydrated = await hydrateVideos(
      fresh.map((r) => r.videoId),
      viewer,
    );
    hydrated.forEach((v, k) => {
      v.repostedBy = fresh.find((r) => r.videoId === v.id)?.name ?? null;
      items.splice(Math.min(items.length, 2 + 3 * k), 0, v);
    });
  }
  return {
    items,
    nextCursor: rows.length > PAGE && last ? `${last.readyAt.toISOString()}|${last.id}` : null,
  };
}

// Người mình follow đăng video mới → thông báo (đăng ký ở src/server/creator.ts qua creator.onVideoReady).
export async function notifyFollowersOfVideo(video: { id: string; authorId: string; caption: string }) {
  const [author, followers] = await Promise.all([
    db.user.findUnique({ where: { id: video.authorId }, select: { displayName: true } }),
    db.follow.findMany({ where: { followeeId: video.authorId }, select: { followerId: true } }),
  ]);
  for (const f of followers)
    await notifyKey(
      f.followerId,
      'notify.followNewVideo',
      { name: author?.displayName ?? '9MUA', caption: video.caption.slice(0, 60) },
      `/video?v=${video.id}`,
    );
}

export const FOLLOW_PAGE = 30;
export type FollowPerson = { id: string; displayName: string; avatarUrl: string | null };

// Danh sách Người theo dõi / Đang theo dõi trên trang cá nhân (SPEC-social.md bổ sung 30/10, A2): mới theo dõi hiện
// trước, 30 người mỗi trang, bỏ tài khoản bị khoá. Chỉ có tên và ảnh đại diện.
export async function followList(
  userId: string,
  kind: 'followers' | 'following',
  page = 1,
): Promise<{ items: FollowPerson[]; hasMore: boolean }> {
  const skip = (Math.max(1, Math.floor(page)) - 1) * FOLLOW_PAGE;
  // Bảng Follow không khai báo quan hệ Prisma (thêm vào sẽ sinh khoá ngoại trên bảng đang có dữ liệu) nên nối bằng SQL.
  const [mine, other] =
    kind === 'followers'
      ? [Prisma.sql`f."followeeId"`, Prisma.sql`f."followerId"`]
      : [Prisma.sql`f."followerId"`, Prisma.sql`f."followeeId"`];
  const rows = await db.$queryRaw<FollowPerson[]>`
    SELECT u.id, u."displayName", u."avatarUrl"
    FROM "Follow" f JOIN "User" u ON u.id = ${other}
    WHERE ${mine} = ${userId} AND u."lockedAt" IS NULL
    ORDER BY f."createdAt" DESC, u.id
    LIMIT ${FOLLOW_PAGE + 1} OFFSET ${skip}`;
  return { items: rows.slice(0, FOLLOW_PAGE), hasMore: rows.length > FOLLOW_PAGE };
}
