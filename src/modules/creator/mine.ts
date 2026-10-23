import { db } from '@/lib/db';

export type MyVideo = {
  id: string;
  caption: string;
  status: string;
  failReason: string | null;
  moderationNote: string | null;
  posterUrl: string | null;
  views: number;
  likes: number;
  orders: number; // đơn hoàn tất có món mua từ video này
  createdAt: Date;
};

// Thống kê của tôi (SPEC-creator.md mục 8). Đơn hoàn tất đếm theo OrderItem.sourceVideoId.
export async function myVideoStats(userId: string): Promise<MyVideo[]> {
  const videos = await db.video.findMany({
    where: { authorId: userId, status: { not: 'deleted' } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const ids = videos.map((v) => v.id);
  const counts = ids.length
    ? await db.$queryRaw<{ videoId: string; orders: number }[]>`
        SELECT oi."sourceVideoId" AS "videoId", COUNT(DISTINCT oi."orderId")::int AS orders
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
        WHERE oi."sourceVideoId" = ANY(${ids}) AND o.status = 'completed'
        GROUP BY oi."sourceVideoId"`
    : [];
  const orders = new Map(counts.map((c) => [c.videoId, c.orders]));
  return videos.map((v) => ({
    id: v.id,
    caption: v.caption,
    status: v.status,
    failReason: v.failReason,
    moderationNote: v.moderationNote,
    posterUrl: v.posterUrl,
    views: v.views,
    likes: v.likes,
    orders: orders.get(v.id) ?? 0,
    createdAt: v.createdAt,
  }));
}
