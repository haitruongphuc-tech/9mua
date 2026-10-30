import { describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { setClock } from '@/lib/clock';
import type { OrderStatus } from '@prisma/client';
import { addToCart } from '@/modules/orders';
import { placeOrder } from '@/modules/orders/place-order';
import { getPayment } from '@/server/payments';
import { createProduct, createSeller, createUser, sampleAddress } from '../../../tests/helpers/factories';
import { simulatePaid } from '../../../tests/helpers/payments';
import { creatorStats, myVideoStats } from './index';

const T = new Date('2026-10-30T05:00:00Z'); // 12:00 giờ Việt Nam
const daysAgo = (n: number) => new Date(T.getTime() - n * 86_400_000);

async function readyVideo(authorId: string) {
  return db.video.create({
    data: {
      authorId,
      caption: 'v',
      hashtags: [],
      status: 'ready',
      fileUrl: '/uploads/v.mp4',
      readyAt: daysAgo(40),
    },
  });
}

// Đơn thật (giỏ → đặt → thanh toán giả) có 1 món mua từ video, rồi đặt trạng thái và thời điểm thanh toán cần thử.
async function orderFrom(
  videoId: string,
  kiotId: string,
  status: OrderStatus,
  paidAt: Date,
  price: number,
  qty: number,
) {
  const product = await createProduct(kiotId, { price, stock: 10 });
  await db.videoProduct.create({ data: { videoId, productId: product.id, position: 0 } });
  const buyer = await createUser();
  await addToCart(buyer.id, product.id, qty, videoId);
  const placed = await placeOrder(buyer.id, { address: sampleAddress, notes: {}, saveAddress: false });
  if (!placed.ok) throw new Error(JSON.stringify(placed));
  await simulatePaid((await getPayment(placed.intentId))!.orderCode);
  const order = await db.order.findFirstOrThrow({ where: { checkoutId: placed.checkoutId } });
  await db.order.update({ where: { id: order.id }, data: { status, paidAt } });
}

describe('thống kê creator 7/30 ngày (SPEC-social.md bổ sung 30/10, A4)', () => {
  it('đếm đúng lượt xem, thích, bình luận, người theo dõi mới, đơn và doanh số trong khoảng; bỏ đơn huỷ/hoàn tiền', async () => {
    setClock(T);
    const me = await createUser();
    const v = await readyVideo(me.id);
    const other = await readyVideo((await createUser()).id);
    const fans = await Promise.all([1, 2, 3].map(() => createUser()));

    // Lượt xem: 1 dòng/người/ngày. 2 trong 7 ngày, 1 ở ngày thứ 10, 1 của video người khác.
    await db.videoView.createMany({
      data: [
        { videoId: v.id, viewerKey: 'u:a', day: '2026-10-30' },
        { videoId: v.id, viewerKey: 'u:b', day: '2026-10-24' },
        { videoId: v.id, viewerKey: 'u:a', day: '2026-10-20' },
        { videoId: other.id, viewerKey: 'u:a', day: '2026-10-30' },
      ],
    });
    await db.videoLike.createMany({
      data: [
        { videoId: v.id, userId: fans[0]!.id, createdAt: daysAgo(1) },
        { videoId: v.id, userId: fans[1]!.id, createdAt: daysAgo(20) },
      ],
    });
    await db.comment.createMany({
      data: [
        { videoId: v.id, userId: fans[0]!.id, text: 'Ngon', createdAt: daysAgo(2) },
        { videoId: v.id, userId: fans[1]!.id, text: 'Bị ẩn', createdAt: daysAgo(2), hiddenAt: daysAgo(1) },
      ],
    });
    await db.follow.createMany({
      data: [
        { followerId: fans[0]!.id, followeeId: me.id, createdAt: daysAgo(3) },
        { followerId: fans[1]!.id, followeeId: me.id, createdAt: daysAgo(15) },
      ],
    });
    await db.savedVideo.create({ data: { userId: fans[2]!.id, videoId: v.id } });
    const seller = await createSeller({ active: true });
    await orderFrom(v.id, seller.kiotId, 'paid', daysAgo(1), 45_000, 2); // 90.000
    await orderFrom(v.id, seller.kiotId, 'completed', daysAgo(12), 100_000, 1); // chỉ trong 30 ngày
    await orderFrom(v.id, seller.kiotId, 'cancelled', daysAgo(1), 500_000, 1);
    await orderFrom(v.id, seller.kiotId, 'refunded', daysAgo(1), 500_000, 1);
    await orderFrom(v.id, seller.kiotId, 'pending_payment', daysAgo(1), 500_000, 1);

    expect(await creatorStats(me.id, 7)).toEqual({
      days: 7,
      views: 2,
      likes: 1,
      comments: 1,
      newFollowers: 1,
      orders: 1,
      revenue: 90_000,
    });
    expect(await creatorStats(me.id, 30)).toEqual({
      days: 30,
      views: 3,
      likes: 2,
      comments: 1,
      newFollowers: 2,
      orders: 2,
      revenue: 190_000,
    });

    // Từng video: thêm số bình luận (không tính bị ẩn), lượt lưu, doanh số (đơn đã thanh toán, trừ huỷ/hoàn tiền).
    expect((await myVideoStats(me.id))[0]).toMatchObject({
      comments: 1,
      saves: 1,
      orders: 2,
      revenue: 190_000,
    });
  });

  it('chưa có video thì mọi số là 0', async () => {
    setClock(T);
    const me = await createUser();
    expect(await creatorStats(me.id, 7)).toEqual({
      days: 7,
      views: 0,
      likes: 0,
      comments: 0,
      newFollowers: 0,
      orders: 0,
      revenue: 0,
    });
  });
});
