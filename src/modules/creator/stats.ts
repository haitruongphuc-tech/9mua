import type { OrderStatus } from '@prisma/client';
import { now, startOfVnDay } from '@/lib/clock';
import { db } from '@/lib/db';

// Đơn được tính là "đơn từ video": đã thanh toán, trừ đơn huỷ, đang hoàn tiền, đã hoàn tiền (SPEC-social.md bổ sung
// 30/10, A4). Dùng chung cho thống kê tổng và từng video để hai chỗ khớp nhau.
export const PAID_STATUSES: OrderStatus[] = [
  'paid',
  'confirmed',
  'shipping',
  'delivered',
  'completed',
  'disputed',
];

export type CreatorStats = {
  days: 7 | 30;
  views: number; // mỗi người xem tính 1 lần mỗi ngày
  likes: number;
  comments: number; // không tính bình luận đã bị ẩn
  newFollowers: number;
  orders: number;
  revenue: number; // VNĐ: giá × số lượng các món mua từ video (tiền hàng của Kiot, không phải thu nhập creator)
};

const vnDayOf = (at: Date) => new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

// Thống kê 7 / 30 ngày gần nhất theo giờ Việt Nam (tính cả hôm nay) cho đầu trang /video/cua-toi.
export async function creatorStats(userId: string, days: 7 | 30): Promise<CreatorStats> {
  const since = startOfVnDay(new Date(now().getTime() - (days - 1) * 86_400_000));
  const ids = (await db.video.findMany({ where: { authorId: userId }, select: { id: true } })).map(
    (v) => v.id,
  );
  const [views, likes, comments, newFollowers, sales] = await Promise.all([
    db.videoView.count({ where: { videoId: { in: ids }, day: { gte: vnDayOf(since) } } }),
    db.videoLike.count({ where: { videoId: { in: ids }, createdAt: { gte: since } } }),
    db.comment.count({ where: { videoId: { in: ids }, hiddenAt: null, createdAt: { gte: since } } }),
    db.follow.count({ where: { followeeId: userId, createdAt: { gte: since } } }),
    ids.length
      ? db.$queryRaw<{ orders: number; revenue: bigint }[]>`
          SELECT COUNT(DISTINCT o.id)::int AS orders, COALESCE(SUM(oi.price * oi.qty), 0)::bigint AS revenue
          FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
          WHERE oi."sourceVideoId" = ANY(${ids}) AND o.status::text = ANY(${PAID_STATUSES})
            AND o."paidAt" >= ${since}`
      : Promise.resolve([{ orders: 0, revenue: 0n }]),
  ]);
  return {
    days,
    views,
    likes,
    comments,
    newFollowers,
    orders: sales[0]?.orders ?? 0,
    revenue: Number(sales[0]?.revenue ?? 0),
  };
}
