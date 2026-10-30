import { Prisma } from '@prisma/client';
import { now } from '@/lib/clock';
import { notBlockedWith } from '@/lib/blocks';
import { db } from '@/lib/db';
import { activePinIds, addPin } from '@/lib/pins';
import { kiotOrigin } from '@/lib/urls';
import { getProductForCheckout, productPath } from '@/modules/kiot';
import { feedScore } from './score';
import { visibleToSql } from './visibility';

export type Viewer = { userId?: string; anonId?: string };

export type FeedProduct = { id: string; name: string; price: number; thumbUrl: string | null; url: string };

export type FeedVideo = {
  id: string;
  fileUrl: string;
  posterUrl: string | null;
  caption: string;
  hashtags: string[];
  width: number | null;
  height: number | null;
  durationSec: number | null;
  author: { id: string; displayName: string; avatarUrl: string | null };
  likes: number;
  views: number;
  liked: boolean;
  pinned: boolean; // CEO ghim lên đầu "Dành cho bạn"
  duetOfId: string | null; // video Duet: link về video gốc
  products: FeedProduct[];
};

export const FEED_PAGE = 8;
const FRESH_SHARE = 0.3; // trộn 30% video mới nhất để video mới có cơ hội
const MAX_SERVED_IN_CURSOR = 300;

// Video được lên feed: đã xử lý xong, không phải Story 24 giờ, và tài khoản người đăng không bị khoá.
const VISIBLE = Prisma.sql`v.status = 'ready' AND v.kind = 'video' AND u."lockedAt" IS NULL`;
// Feed Dành cho bạn, video ghim: chỉ video công khai (SPEC-creator.md V5.3).
const PUBLIC = Prisma.sql`${VISIBLE} AND v.visibility = 'public'`;

type Row = { id: string };

function decodeServed(cursor?: string): string[] {
  if (!cursor) return [];
  try {
    const ids = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    return Array.isArray(ids)
      ? ids.filter((x): x is string => typeof x === 'string').slice(-MAX_SERVED_IN_CURSOR)
      : [];
  } catch {
    return [];
  }
}

// Feed (SPEC-creator.md mục 3): theo điểm giảm dần, trộn 30% video mới nhất, không lặp video trong một phiên
// cuộn (con trỏ mang danh sách đã xem), người đã đăng nhập không thấy lại video vừa xem trong 24 giờ.
export async function getFeed(
  viewer: Viewer,
  cursor?: string,
  options: { first?: string; limit?: number } = {},
): Promise<{ items: FeedVideo[]; nextCursor: string | null }> {
  const limit = options.limit ?? FEED_PAGE;
  const served = decodeServed(cursor);
  const exclude = [...served, ...(options.first ? [options.first] : [])];
  const since = new Date(now().getTime() - 24 * 3_600_000);
  const seenFilter = viewer.userId
    ? Prisma.sql`AND NOT EXISTS (SELECT 1 FROM "VideoView" vv WHERE vv."videoId" = v.id
        AND vv."viewerKey" = ${`u:${viewer.userId}`} AND vv."createdAt" >= ${since})`
    : Prisma.empty;
  const notServed = exclude.length ? Prisma.sql`AND NOT (v.id = ANY(${exclude}))` : Prisma.empty;
  // Không hiện video của người chặn nhau với người xem (SPEC-social.md V5.3).
  const notBlocked = Prisma.sql`AND ${notBlockedWith(viewer.userId, Prisma.sql`v."authorId"`)}`;

  const freshCount = Math.max(1, Math.round(limit * FRESH_SHARE));
  const [top, fresh] = await Promise.all([
    db.$queryRaw<Row[]>`
      SELECT v.id FROM "Video" v JOIN "User" u ON u.id = v."authorId"
      WHERE ${PUBLIC} ${notServed} ${seenFilter} ${notBlocked}
      ORDER BY v.score DESC, v."readyAt" DESC LIMIT ${limit}`,
    db.$queryRaw<Row[]>`
      SELECT v.id FROM "Video" v JOIN "User" u ON u.id = v."authorId"
      WHERE ${PUBLIC} ${notServed} ${seenFilter} ${notBlocked}
      ORDER BY v."readyAt" DESC LIMIT ${limit}`,
  ]);

  // Cứ khoảng 3 video theo điểm thì chèn 1 video mới nhất (nếu chưa có trong trang).
  const ids: string[] = [];
  const freshQueue = fresh.map((r) => r.id);
  let freshUsed = 0;
  for (const r of top) {
    if (ids.length >= limit) break;
    if (!ids.includes(r.id)) ids.push(r.id);
    if (ids.length % 3 === 2 && freshUsed < freshCount) {
      const f = freshQueue.find((id) => !ids.includes(id));
      if (f && ids.length < limit) {
        ids.push(f);
        freshUsed += 1;
      }
    }
  }
  for (const id of freshQueue) if (ids.length < limit && !ids.includes(id)) ids.push(id);

  // Hết video chưa xem thì chiếu lại video đã xem trong 24 giờ, theo điểm (SPEC-creator.md bổ sung 29/10): feed của
  // người đã đăng nhập không bao giờ trống khi web còn video.
  if (viewer.userId && ids.length < limit) {
    const taken = ids.length ? Prisma.sql`AND NOT (v.id = ANY(${ids}))` : Prisma.empty;
    const seen = await db.$queryRaw<Row[]>`
      SELECT v.id FROM "Video" v JOIN "User" u ON u.id = v."authorId"
      WHERE ${PUBLIC} ${notServed} ${taken} ${notBlocked}
      ORDER BY v.score DESC, v."readyAt" DESC LIMIT ${limit - ids.length}`;
    ids.push(...seen.map((r) => r.id));
  }

  // Trang đầu: video CEO ghim lên đầu (SPEC-admin.md bổ sung 27/10), kể cả video đã xem.
  if (!served.length && !options.first) {
    const pinned = await activePinIds('video');
    if (pinned.length) {
      const ok = await db.$queryRaw<Row[]>`
        SELECT v.id FROM "Video" v JOIN "User" u ON u.id = v."authorId"
        WHERE ${PUBLIC} AND v.id = ANY(${pinned}) ${notBlocked}`;
      const okSet = new Set(ok.map((r) => r.id));
      const head = pinned.filter((id) => okSet.has(id));
      for (let i = ids.length - 1; i >= 0; i--) if (head.includes(ids[i]!)) ids.splice(i, 1);
      ids.unshift(...head);
    }
  }

  if (options.first && !served.length) {
    const first = await db.$queryRaw<Row[]>`
      SELECT v.id FROM "Video" v JOIN "User" u ON u.id = v."authorId"
      WHERE ${VISIBLE} AND v.id = ${options.first} ${notBlocked} AND ${visibleToSql(viewer.userId)}`;
    if (first[0]) ids.unshift(first[0].id);
  }

  const items = await hydrateVideos(ids, viewer);
  const nextServed = [...served, ...ids].slice(-MAX_SERVED_IN_CURSOR);
  return {
    items,
    nextCursor: ids.length === 0 ? null : Buffer.from(JSON.stringify(nextServed)).toString('base64url'),
  };
}

// Thẻ sản phẩm chỉ hiện khi sản phẩm còn bán, còn hàng và Kiot đang hoạt động; video vẫn hiện.
async function feedProducts(productIds: string[]): Promise<FeedProduct[]> {
  const found = await Promise.all(productIds.map((id) => getProductForCheckout(id)));
  const live = found.filter((p) => p?.available && p.stock > 0).map((p) => p!);
  if (live.length === 0) return [];
  const kiots = await db.kiot.findMany({
    where: { id: { in: live.map((p) => p.kiotId) } },
    select: { id: true, slug: true },
  });
  const slug = new Map(kiots.map((k) => [k.id, k.slug]));
  return live.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    thumbUrl: p.imageUrl,
    url: `${kiotOrigin(slug.get(p.kiotId)!)}${productPath(p)}`,
  }));
}

export async function hydrateVideos(ids: string[], viewer: Viewer): Promise<FeedVideo[]> {
  if (ids.length === 0) return [];
  const [videos, likes, pins] = await Promise.all([
    db.video.findMany({
      where: { id: { in: ids } },
      include: { products: { orderBy: { position: 'asc' } } },
    }),
    viewer.userId
      ? db.videoLike.findMany({
          where: { userId: viewer.userId, videoId: { in: ids } },
          select: { videoId: true },
        })
      : Promise.resolve([]),
    activePinIds('video'),
  ]);
  const pinnedSet = new Set(pins);
  const authors = await db.user.findMany({
    where: { id: { in: videos.map((v) => v.authorId) } },
    select: { id: true, displayName: true, avatarUrl: true },
  });
  const authorById = new Map(authors.map((a) => [a.id, a]));
  const liked = new Set(likes.map((l) => l.videoId));
  const byId = new Map(videos.map((v) => [v.id, v]));
  const out: FeedVideo[] = [];
  for (const id of ids) {
    const v = byId.get(id);
    if (!v?.fileUrl) continue;
    out.push({
      id: v.id,
      fileUrl: v.fileUrl,
      posterUrl: v.posterUrl,
      caption: v.caption,
      hashtags: v.hashtags,
      width: v.width,
      height: v.height,
      durationSec: v.durationSec,
      author: authorById.get(v.authorId) ?? { id: v.authorId, displayName: 'Creator', avatarUrl: null },
      likes: v.likes,
      views: v.views,
      liked: liked.has(v.id),
      pinned: pinnedSet.has(v.id),
      duetOfId: v.duetOfId,
      products: await feedProducts(v.products.map((p) => p.productId)),
    });
  }
  return out;
}

export async function getVideo(videoId: string, viewer: Viewer): Promise<FeedVideo | null> {
  const rows = await db.$queryRaw<Row[]>`
    SELECT v.id FROM "Video" v JOIN "User" u ON u.id = v."authorId"
    WHERE ${VISIBLE} AND v.id = ${videoId} AND ${notBlockedWith(viewer.userId, Prisma.sql`v."authorId"`)}
      AND ${visibleToSql(viewer.userId)}`;
  return rows[0] ? ((await hydrateVideos([rows[0].id], viewer))[0] ?? null) : null;
}

// Tính lại điểm feed cho video đã đăng (worker chạy mỗi 5 phút).
export async function recomputeScores(): Promise<number> {
  const videos = await db.video.findMany({
    where: { status: 'ready' },
    select: { id: true, likes: true, qualifiedViews: true, readyAt: true, createdAt: true },
  });
  const t = now().getTime();
  for (const v of videos) {
    const ageHours = (t - (v.readyAt ?? v.createdAt).getTime()) / 3_600_000;
    await db.video.update({
      where: { id: v.id },
      data: { score: feedScore({ likes: v.likes, qualifiedViews: v.qualifiedViews, ageHours }) },
    });
  }
  return videos.length;
}

// Gắn nguồn video vào giỏ chỉ khi video đó thật sự có gắn sản phẩm này (chống ghi nguồn giả).
export async function isProductTagged(videoId: string, productId: string): Promise<boolean> {
  return (await db.videoProduct.count({ where: { videoId, productId, video: { status: 'ready' } } })) > 0;
}

// CEO ghim video lên đầu feed: chỉ video đang hiện trên feed.
export async function pinVideo(
  videoId: string,
  adminId: string,
  until: Date | null,
): Promise<{ ok: true } | { ok: false; error: 'NOT_FOUND' | 'FULL' | 'EXISTS' }> {
  const rows = await db.$queryRaw<Row[]>`
    SELECT v.id FROM "Video" v JOIN "User" u ON u.id = v."authorId" WHERE ${PUBLIC} AND v.id = ${videoId}`;
  if (!rows[0]) return { ok: false, error: 'NOT_FOUND' };
  return addPin('video', videoId, adminId, until);
}
