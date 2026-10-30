import { db } from '@/lib/db';
import { PAID_STATUSES } from './stats';

export type MyVideo = {
  id: string;
  caption: string;
  status: string;
  kind: 'video' | 'story';
  expiresAt: Date | null; // Story: hết hạn sau 24 giờ
  duetOfId: string | null;
  failReason: string | null;
  moderationNote: string | null;
  posterUrl: string | null;
  views: number;
  likes: number;
  orders: number; // đơn đã thanh toán (trừ huỷ / hoàn tiền) có món mua từ video này
  revenue: number; // VNĐ: giá × số lượng các món đó
  comments: number; // không tính bình luận đã bị ẩn
  saves: number;
  createdAt: Date;
  // SPEC-creator.md V5.3
  draft: boolean;
  publishAt: Date | null;
  profilePinned: boolean;
  edited: boolean;
  captionStatus: string | null; // phụ đề tự động (SPEC-creator.md V5.4)
};

// Thống kê của tôi (SPEC-creator.md mục 8, bổ sung 30/10 A4). Đơn đếm theo OrderItem.sourceVideoId, cùng cách tính
// với thống kê 7/30 ngày: đơn đã thanh toán, trừ huỷ / hoàn tiền.
export async function myVideoStats(userId: string): Promise<MyVideo[]> {
  const videos = await db.video.findMany({
    where: { authorId: userId, status: { not: 'deleted' } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { captions: { select: { status: true } } },
  });
  const ids = videos.map((v) => v.id);
  const [sales, comments, saves] = ids.length
    ? await Promise.all([
        db.$queryRaw<{ videoId: string; orders: number; revenue: bigint }[]>`
          SELECT oi."sourceVideoId" AS "videoId", COUNT(DISTINCT oi."orderId")::int AS orders,
            SUM(oi.price * oi.qty)::bigint AS revenue
          FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
          WHERE oi."sourceVideoId" = ANY(${ids}) AND o.status::text = ANY(${PAID_STATUSES})
          GROUP BY oi."sourceVideoId"`,
        db.comment.groupBy({
          by: ['videoId'],
          where: { videoId: { in: ids }, hiddenAt: null },
          _count: true,
        }),
        db.savedVideo.groupBy({ by: ['videoId'], where: { videoId: { in: ids } }, _count: true }),
      ])
    : [[], [], []];
  const sale = new Map(sales.map((c) => [c.videoId, c]));
  const commentCount = new Map(comments.map((c) => [c.videoId, c._count]));
  const saveCount = new Map(saves.map((c) => [c.videoId, c._count]));
  return videos.map((v) => ({
    id: v.id,
    caption: v.caption,
    status: v.status,
    kind: v.kind === 'story' ? 'story' : 'video',
    expiresAt: v.expiresAt,
    duetOfId: v.duetOfId,
    failReason: v.failReason,
    moderationNote: v.moderationNote,
    posterUrl: v.posterUrl,
    views: v.views,
    likes: v.likes,
    orders: sale.get(v.id)?.orders ?? 0,
    revenue: Number(sale.get(v.id)?.revenue ?? 0),
    comments: commentCount.get(v.id) ?? 0,
    saves: saveCount.get(v.id) ?? 0,
    createdAt: v.createdAt,
    draft: v.draft,
    publishAt: v.publishAt,
    profilePinned: v.profilePinnedAt !== null,
    edited: v.editedAt !== null,
    captionStatus: v.captions?.status ?? null,
  }));
}
