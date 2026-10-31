import { randomBytes } from 'node:crypto';
import { now } from '@/lib/clock';
import { db, type Tx } from '@/lib/db';
import { hasLink } from '@/lib/links';
import { imageStore } from '@/lib/media/image-store';
import { processImage } from '@/lib/media/process-image';
import { notifyKey } from '@/lib/notifications';

// Đánh giá sản phẩm, sao Kiot (SPEC-orders.md V5.1, công tắc reviews). Mỗi OrderItem một đánh giá, trong 30 ngày từ khi
// giao; đơn đã / đang hoàn tiền thì không đánh giá mới. Product.ratingAvg / ratingCount tính lại trong cùng transaction.
export const REVIEW_WINDOW_DAYS = 30;
export const EDIT_WINDOW_DAYS = 7;
export const MAX_REVIEW_TEXT = 1000;
export const MAX_REPLY_TEXT = 500;
export const MAX_REVIEW_IMAGES = 5;
export const REVIEW_AUTO_HIDE_REPORTERS = 5;
export const KIOT_STARS_MIN_REVIEWS = 3;
const DAY = 86_400_000;

export type ReviewError =
  'NOT_FOUND' | 'NOT_ALLOWED' | 'EXPIRED' | 'EXISTS' | 'INVALID' | 'HAS_LINK' | 'EDIT_USED' | 'IMAGE_INVALID';

async function recomputeRating(tx: Tx, productId: string) {
  const agg = await tx.productReview.aggregate({
    where: { productId, hiddenAt: null },
    _avg: { stars: true },
    _count: { _all: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: { ratingAvg: agg._avg.stars ?? 0, ratingCount: agg._count._all },
  });
}

// Đơn có món này đã giao / hoàn tất, trong 30 ngày từ deliveredAt, không hoàn tiền.
async function reviewableItem(buyerId: string, orderItemId: string) {
  const item = await db.orderItem.findUnique({ where: { id: orderItemId }, include: { order: true } });
  if (!item || item.order.buyerId !== buyerId) return { ok: false as const, error: 'NOT_FOUND' as const };
  const o = item.order;
  if (!['delivered', 'completed'].includes(o.status) || !o.deliveredAt)
    return { ok: false as const, error: 'NOT_ALLOWED' as const };
  if (o.deliveredAt.getTime() < now().getTime() - REVIEW_WINDOW_DAYS * DAY)
    return { ok: false as const, error: 'EXPIRED' as const };
  return { ok: true as const, item };
}

function cleanText(text: string): { ok: true; text: string } | { ok: false; error: ReviewError } {
  const t = text.replace(/\r\n/g, '\n').trim();
  if (t.length > MAX_REVIEW_TEXT) return { ok: false, error: 'INVALID' };
  if (hasLink(t)) return { ok: false, error: 'HAS_LINK' };
  return { ok: true, text: t };
}

async function saveImages(buyerId: string, images: Buffer[]) {
  const out: { url: string; thumbUrl: string; width: number; height: number }[] = [];
  for (const data of images.slice(0, MAX_REVIEW_IMAGES)) {
    if (data.length > 10 * 1024 * 1024) return null;
    const p = await processImage(data);
    if (!p.ok) return null;
    const key = `reviews/${buyerId.slice(-6)}-${randomBytes(8).toString('hex')}`;
    out.push({
      url: await imageStore().save(`${key}.webp`, p.main),
      thumbUrl: await imageStore().save(`${key}-t.webp`, p.thumb),
      width: p.width,
      height: p.height,
    });
  }
  return out;
}

export async function canReviewItem(buyerId: string, orderItemId: string): Promise<boolean> {
  const r = await reviewableItem(buyerId, orderItemId);
  if (!r.ok) return false;
  return !(await db.productReview.findUnique({ where: { orderItemId } }));
}

export async function createReview(
  buyerId: string,
  orderItemId: string,
  input: { stars: number; text?: string; images?: Buffer[] },
): Promise<{ ok: true; reviewId: string } | { ok: false; error: ReviewError }> {
  const r = await reviewableItem(buyerId, orderItemId);
  if (!r.ok) return r;
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5)
    return { ok: false, error: 'INVALID' };
  const c = cleanText(input.text ?? '');
  if (!c.ok) return c;
  if ((input.images?.length ?? 0) > MAX_REVIEW_IMAGES) return { ok: false, error: 'INVALID' };
  if (await db.productReview.findUnique({ where: { orderItemId } })) return { ok: false, error: 'EXISTS' };
  const media = await saveImages(buyerId, input.images ?? []);
  if (!media) return { ok: false, error: 'IMAGE_INVALID' };
  const product = await db.product.findUniqueOrThrow({
    where: { id: r.item.productId },
    select: { kiotId: true },
  });
  try {
    const review = await db.$transaction(async (tx) => {
      const created = await tx.productReview.create({
        data: {
          orderItemId,
          productId: r.item.productId,
          kiotId: product.kiotId,
          buyerId,
          stars: input.stars,
          text: c.text,
          createdAt: now(),
          media: { create: media.map((m, position) => ({ ...m, position })) },
        },
      });
      await recomputeRating(tx, r.item.productId);
      return created;
    });
    return { ok: true, reviewId: review.id };
  } catch {
    return { ok: false, error: 'EXISTS' };
  }
}

// Sửa 1 lần trong 7 ngày (sao và chữ; ảnh giữ nguyên).
export async function editReview(
  buyerId: string,
  reviewId: string,
  input: { stars: number; text?: string },
): Promise<{ ok: true } | { ok: false; error: ReviewError }> {
  const review = await db.productReview.findFirst({ where: { id: reviewId, buyerId } });
  if (!review) return { ok: false, error: 'NOT_FOUND' };
  if (review.editedAt || review.createdAt.getTime() < now().getTime() - EDIT_WINDOW_DAYS * DAY)
    return { ok: false, error: 'EDIT_USED' };
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5)
    return { ok: false, error: 'INVALID' };
  const c = cleanText(input.text ?? '');
  if (!c.ok) return c;
  await db.$transaction(async (tx) => {
    await tx.productReview.update({
      where: { id: reviewId },
      data: { stars: input.stars, text: c.text, editedAt: now() },
    });
    await recomputeRating(tx, review.productId);
  });
  return { ok: true };
}

// Chủ Kiot trả lời 1 lần (≤ 500 ký tự). Không xoá / ẩn được đánh giá.
export async function replyReview(
  ownerId: string,
  reviewId: string,
  text: string,
): Promise<{ ok: true } | { ok: false; error: ReviewError }> {
  const review = await db.productReview.findUnique({ where: { id: reviewId } });
  const kiot = review
    ? await db.kiot.findUnique({ where: { id: review.kiotId }, select: { ownerId: true } })
    : null;
  if (!review || kiot?.ownerId !== ownerId) return { ok: false, error: 'NOT_FOUND' };
  if (review.reply) return { ok: false, error: 'EDIT_USED' };
  const t = text.trim();
  if (!t || t.length > MAX_REPLY_TEXT) return { ok: false, error: 'INVALID' };
  if (hasLink(t)) return { ok: false, error: 'HAS_LINK' };
  await db.productReview.update({ where: { id: reviewId }, data: { reply: t, repliedAt: now() } });
  return { ok: true };
}

// Báo cáo đánh giá: 5 người khác nhau thì tự ẩn chờ CEO.
export async function reportReview(userId: string, reviewId: string, reason: string): Promise<boolean> {
  const review = await db.productReview.findUnique({ where: { id: reviewId } });
  if (!review || review.buyerId === userId) return false;
  await db.reviewReport.upsert({
    where: { reviewId_userId: { reviewId, userId } },
    create: { reviewId, userId, reason: reason.slice(0, 50), createdAt: now() },
    update: {},
  });
  if (
    (await db.reviewReport.count({ where: { reviewId, status: 'open' } })) >= REVIEW_AUTO_HIDE_REPORTERS &&
    !review.hiddenAt
  )
    await db.$transaction(async (tx) => {
      await tx.productReview.update({
        where: { id: reviewId },
        data: { hiddenAt: now(), hiddenBy: 'reports' },
      });
      await recomputeRating(tx, review.productId);
    });
  return true;
}

export async function listReviewReports() {
  const reports = await db.reviewReport.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  const ids = [...new Set(reports.map((r) => r.reviewId))];
  const reviews = await db.productReview.findMany({ where: { id: { in: ids } } });
  return ids.map((id) => ({
    review: reviews.find((r) => r.id === id) ?? null,
    count: reports.filter((r) => r.reviewId === id).length,
  }));
}

// CEO ẩn kèm lý do, hoặc bỏ qua (đánh giá tự ẩn thì hiện lại).
export async function resolveReviewReports(
  reviewId: string,
  action: 'hide' | 'dismiss',
  reason = '',
): Promise<boolean> {
  const review = await db.productReview.findUnique({ where: { id: reviewId } });
  if (!review) return false;
  await db.$transaction(async (tx) => {
    await tx.reviewReport.updateMany({
      where: { reviewId, status: 'open' },
      data: { status: action === 'hide' ? 'actioned' : 'dismissed' },
    });
    if (action === 'hide')
      await tx.productReview.update({
        where: { id: reviewId },
        data: { hiddenAt: now(), hiddenBy: `admin: ${reason.slice(0, 200)}` },
      });
    else if (review.hiddenBy === 'reports')
      await tx.productReview.update({ where: { id: reviewId }, data: { hiddenAt: null, hiddenBy: null } });
    await recomputeRating(tx, review.productId);
  });
  return true;
}

export type ReviewView = {
  id: string;
  stars: number;
  text: string;
  buyerName: string;
  itemName: string; // "Đã mua · <tên lúc mua>"
  media: { url: string; thumbUrl: string }[];
  reply: string | null;
  edited: boolean;
  createdAt: Date;
};

export type ReviewSummary = { avg: number; count: number; dist: Record<1 | 2 | 3 | 4 | 5, number> };

// Trang sản phẩm: tóm tắt + danh sách đánh giá đang hiện, lọc theo số sao / có ảnh.
export async function productReviews(
  productId: string,
  filter: { stars?: number; withMedia?: boolean } = {},
  take = 30,
): Promise<{ summary: ReviewSummary; items: ReviewView[] }> {
  const groups = await db.productReview.groupBy({
    by: ['stars'],
    where: { productId, hiddenAt: null },
    _count: { _all: true },
  });
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as ReviewSummary['dist'];
  for (const g of groups) dist[g.stars as 1] = g._count._all;
  const count = Object.values(dist).reduce((a, b) => a + b, 0);
  const avg = count ? Object.entries(dist).reduce((s, [k, v]) => s + Number(k) * v, 0) / count : 0;
  const rows = await db.productReview.findMany({
    where: {
      productId,
      hiddenAt: null,
      ...(filter.stars ? { stars: filter.stars } : {}),
      ...(filter.withMedia ? { media: { some: {} } } : {}),
    },
    include: { media: { orderBy: { position: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take,
  });
  const [buyers, items] = await Promise.all([
    db.user.findMany({
      where: { id: { in: rows.map((r) => r.buyerId) } },
      select: { id: true, displayName: true },
    }),
    db.orderItem.findMany({
      where: { id: { in: rows.map((r) => r.orderItemId) } },
      select: { id: true, name: true },
    }),
  ]);
  return {
    summary: { avg: Math.round(avg * 10) / 10, count, dist },
    items: rows.map((r) => ({
      id: r.id,
      stars: r.stars,
      text: r.text,
      buyerName: buyers.find((b) => b.id === r.buyerId)?.displayName ?? '9MUA',
      itemName: items.find((i) => i.id === r.orderItemId)?.name ?? '',
      media: r.media.map((m) => ({ url: m.url, thumbUrl: m.thumbUrl })),
      reply: r.reply,
      edited: r.editedAt !== null,
      createdAt: r.createdAt,
    })),
  };
}

// Sao Kiot = trung bình mọi đánh giá đang hiện; chỉ có khi từ 3 đánh giá.
export async function kiotRating(kiotId: string): Promise<{ avg: number; count: number } | null> {
  const agg = await db.productReview.aggregate({
    where: { kiotId, hiddenAt: null },
    _avg: { stars: true },
    _count: { _all: true },
  });
  if (agg._count._all < KIOT_STARS_MIN_REVIEWS) return null;
  return { avg: Math.round((agg._avg.stars ?? 0) * 10) / 10, count: agg._count._all };
}

// Đánh giá của tôi cho một món (trang viết / sửa đánh giá).
export async function myReview(buyerId: string, orderItemId: string) {
  return db.productReview.findFirst({ where: { buyerId, orderItemId }, include: { media: true } });
}

// Chủ Kiot xem đánh giá để trả lời.
export async function reviewsForKiot(
  ownerId: string,
  take = 100,
): Promise<(ReviewView & { productId: string })[]> {
  const kiot = await db.kiot.findUnique({ where: { ownerId }, select: { id: true } });
  if (!kiot) return [];
  const rows = await db.productReview.findMany({
    where: { kiotId: kiot.id },
    include: { media: { orderBy: { position: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take,
  });
  const [buyers, items] = await Promise.all([
    db.user.findMany({
      where: { id: { in: rows.map((r) => r.buyerId) } },
      select: { id: true, displayName: true },
    }),
    db.orderItem.findMany({
      where: { id: { in: rows.map((r) => r.orderItemId) } },
      select: { id: true, name: true },
    }),
  ]);
  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    stars: r.stars,
    text: r.text,
    buyerName: buyers.find((b) => b.id === r.buyerId)?.displayName ?? '9MUA',
    itemName: items.find((i) => i.id === r.orderItemId)?.name ?? '',
    media: r.media.map((m) => ({ url: m.url, thumbUrl: m.thumbUrl })),
    reply: r.reply,
    edited: r.editedAt !== null,
    createdAt: r.createdAt,
  }));
}

// Việc định kỳ: nhắc đánh giá 3 ngày sau khi giao (mỗi đơn một lần).
export async function remindReviews(): Promise<number> {
  const t = now();
  const due = await db.order.findMany({
    where: {
      status: { in: ['delivered', 'completed'] },
      reviewRemindedAt: null,
      deliveredAt: {
        lte: new Date(t.getTime() - 3 * DAY),
        gte: new Date(t.getTime() - REVIEW_WINDOW_DAYS * DAY),
      },
    },
    select: { id: true, buyerId: true, code: true },
    take: 200,
  });
  let n = 0;
  for (const o of due) {
    const claimed = await db.order.updateMany({
      where: { id: o.id, reviewRemindedAt: null },
      data: { reviewRemindedAt: t },
    });
    if (!claimed.count) continue;
    await notifyKey(o.buyerId, 'notify.reviewReminder', { code: o.code }, `/don-mua/${o.id}`);
    n += 1;
  }
  return n;
}
